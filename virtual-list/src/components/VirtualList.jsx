import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FixedSizeList } from 'react-window';
import ProductItem from './ProductItem';
import { imageCache } from '../services/imageCache';
import '../App.css';

// 生成商品数据的函数
const generateProducts = (startIndex, count) => {
    return Array.from({ length: count }).map((_, index) => ({
        id: startIndex + index,
        name: `Product ${startIndex + index + 1}`,
        description: `This is a great product ${startIndex + index + 1} with many features.`,
        price: Math.random() * 100,
        imageUrl: `https://picsum.photos/seed/${startIndex + index + 1}/200/150`
    }));
};

const VirtualList = () => {
    // 初始加载20条数据
    const [products, setProducts] = useState(() => generateProducts(0, 20));
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState(null);
    const listRef = useRef(null);
    const containerRef = useRef(null);

    // 加载更多数据
    const loadMore = useCallback(async () => {
        if (loading || !hasMore) return;
        
        setLoading(true);
        setError(null);
        try {
            // 模拟异步加载
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const newProducts = generateProducts(products.length, 20);
            setProducts(prev => [...prev, ...newProducts]);
            
            // 模拟数据加载完毕
            if (products.length >= 100) {
                setHasMore(false);
            }
        } catch (error) {
            console.error('加载数据失败:', error);
            setError('加载数据失败，请重试');
        } finally {
            setLoading(false);
        }
    }, [products.length, loading, hasMore]);

    // 预加载下一批图片
    const preloadNextBatch = useCallback(async () => {
        const nextBatch = generateProducts(products.length, 20);
        const imageUrls = nextBatch.map(product => product.imageUrl);
        await imageCache.preloadImages(imageUrls);
    }, [products.length]);

    // 当产品列表更新时预加载下一批图片
    useEffect(() => {
        if (hasMore && !loading) {
            preloadNextBatch();
        }
    }, [products.length, hasMore, loading, preloadNextBatch]);

    // 处理滚动事件
    const onScroll = useCallback(({ scrollOffset, scrollUpdateWasRequested }) => {
        if (scrollUpdateWasRequested || !listRef.current) return;

        const { height, itemCount, itemSize } = listRef.current.props;
        const maxOffset = itemCount * itemSize - height;
        
        // 当滚动到距离底部 100px 时触发加载
        if (maxOffset - scrollOffset <= 100) {
            loadMore();
        }
    }, [loadMore]);

    const Row = useCallback(({ index, style }) => {
        const product = products[index];
        return (
            <div style={style}>
                <ProductItem product={product} />
            </div>
        );
    }, [products]);

    return (
        <div className="app">
            <h1>Virtual Product List Demo</h1>
            <div ref={containerRef} style={{ height: '400px', width: '400px', overflow: 'auto' }}>
                <FixedSizeList
                    ref={listRef}
                    height={400}
                    width={400}
                    itemSize={150}
                    itemCount={products.length}
                    onScroll={onScroll}
                >
                    {Row}
                </FixedSizeList>
            </div>
            {loading && (
                <div className="loading-more">
                    <div className="loading-spinner"></div>
                    <span>加载中...</span>
                </div>
            )}
            {error && (
                <div className="error-message">
                    {error}
                    <button onClick={loadMore} className="retry-button">
                        重试
                    </button>
                </div>
            )}
            {!hasMore && !error && (
                <div className="no-more">
                    没有更多数据了
                </div>
            )}
        </div>
    );
};

export default VirtualList;    