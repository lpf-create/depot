class ImageCacheService {
    constructor() {
        this.dbName = 'ImageCacheDB';
        this.storeName = 'images';
        this.db = null;
        this.initPromise = this.init();
        this.fallbackImageUrl = '/placeholder/200x150?text=Image+Not+Available';
        this.maxRetries = 3;
        this.retryDelay = 1000;
        this.maxConcurrent = 5;
        this.loadingQueue = [];
        this.activeLoads = 0;
        this.cacheSize = 100;
        this.cacheKeys = new Set();
        this.failedUrls = new Set(); // 记录失败的URL
        this.priorityQueue = new Map(); // 优先级队列
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
        });
    }

    async processQueue() {
        if (this.loadingQueue.length === 0 || this.activeLoads >= this.maxConcurrent) {
            return;
        }

        const { url, resolve, reject } = this.loadingQueue.shift();
        this.activeLoads++;

        try {
            const result = await this.loadImage(url);
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.activeLoads--;
            this.processQueue();
        }
    }

    async loadImage(url) {
        let attempt = 0;
        const maxAttempts = this.maxRetries;

        // 如果URL已经失败过，直接使用备用图片
        if (this.failedUrls.has(url)) {
            return this.fallbackImageUrl;
        }

        while (attempt < maxAttempts) {
            try {
                // 转换URL为代理URL
                const proxyUrl = url.replace('https://picsum.photos', '/api');
                
                const response = await fetch(proxyUrl, {
                    mode: 'cors',
                    headers: {
                        'Accept': 'image/*'
                    },
                    cache: 'no-cache',
                    redirect: 'follow'
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const blob = await response.blob();
                
                // 验证图片是否有效
                if (blob.size === 0) {
                    throw new Error('Empty image blob');
                }

                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                        try {
                            const base64data = reader.result;
                            await this.saveToCache(url, base64data);
                            resolve(base64data);
                        } catch (error) {
                            console.error('处理图片失败:', error);
                            resolve(url);
                        }
                    };
                    reader.onerror = () => {
                        console.error('读取图片失败');
                        resolve(this.fallbackImageUrl);
                    };
                    reader.readAsDataURL(blob);
                });
            } catch (error) {
                console.error(`尝试 ${attempt + 1}/${maxAttempts} 失败:`, error);
                attempt++;
                
                if (attempt === maxAttempts) {
                    console.error('所有重试都失败了，使用备用图片');
                    // 记录失败的URL
                    this.failedUrls.add(url);
                    return this.fallbackImageUrl;
                }
                
                // 指数退避重试
                const delay = this.retryDelay * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    async saveToCache(url, data) {
        if (!this.db) return;

        // 管理缓存大小
        if (this.cacheKeys.size >= this.cacheSize) {
            const oldestKey = Array.from(this.cacheKeys)[0];
            await this.removeFromCache(oldestKey);
        }

        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        await store.put(data, url);
        this.cacheKeys.add(url);
    }

    async removeFromCache(url) {
        if (!this.db) return;

        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        await store.delete(url);
        this.cacheKeys.delete(url);
    }

    async getImage(url, options = {}) {
        try {
            await this.initPromise;

            if (!this.db) {
                throw new Error('数据库未初始化');
            }

            if (this.failedUrls.has(url)) {
                return this.fallbackImageUrl;
            }

            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(url);

            return new Promise((resolve, reject) => {
                request.onerror = () => {
                    console.error('获取缓存失败:', request.error);
                    resolve(this.fallbackImageUrl);
                };
                request.onsuccess = () => {
                    if (request.result) {
                        resolve(request.result);
                    } else {
                        // 根据优先级添加到队列
                        const priority = options.priority || 'normal';
                        this.loadingQueue.push({
                            url,
                            resolve,
                            reject,
                            priority
                        });
                        this.sortQueue();
                        this.processQueue();
                    }
                };
            });
        } catch (error) {
            console.error('获取图片失败:', error);
            return this.fallbackImageUrl;
        }
    }

    sortQueue() {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        this.loadingQueue.sort((a, b) => 
            priorityOrder[a.priority] - priorityOrder[b.priority]
        );
    }

    // 预加载图片
    async preloadImages(urls) {
        const promises = urls.map(url => this.cacheImage(url, { priority: 'low' }));
        return Promise.allSettled(promises);
    }

    async cacheImage(url, retries = this.maxRetries) {
        await this.initPromise;

        if (!this.db) {
            throw new Error('数据库未初始化');
        }

        let attempt = 0;
        
        while (attempt < retries) {
            try {
                // 转换URL为代理URL
                const proxyUrl = url.replace('https://picsum.photos', '/api');
                
                const response = await fetch(proxyUrl, {
                    mode: 'cors',
                    headers: {
                        'Accept': 'image/*'
                    },
                    cache: 'no-cache'
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const blob = await response.blob();
                
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                        try {
                            const base64data = reader.result;
                            const transaction = this.db.transaction([this.storeName], 'readwrite');
                            const store = transaction.objectStore(this.storeName);
                            await store.put(base64data, url);
                            resolve(base64data);
                        } catch (error) {
                            console.error('缓存图片失败:', error);
                            // 如果缓存失败，返回原始URL
                            resolve(url);
                        }
                    };
                    reader.onerror = () => {
                        console.error('读取图片失败');
                        resolve(this.fallbackImageUrl);
                    };
                    reader.readAsDataURL(blob);
                });
            } catch (error) {
                console.error(`尝试 ${attempt + 1}/${retries} 失败:`, error);
                attempt++;
                
                if (attempt === retries) {
                    console.error('所有重试都失败了，使用备用图片');
                    return this.fallbackImageUrl;
                }
                
                // 指数退避重试
                const delay = this.retryDelay * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    async clearCache() {
        await this.initPromise;

        if (!this.db) {
            throw new Error('数据库未初始化');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.cacheKeys.clear();
                resolve();
            };
        });
    }

    // 清除失败的URL记录
    clearFailedUrls() {
        this.failedUrls.clear();
    }
}

export const imageCache = new ImageCacheService(); 