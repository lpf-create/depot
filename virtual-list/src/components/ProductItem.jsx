import React, { useState, useEffect, useCallback } from 'react';
import { imageCache } from '../services/imageCache';
import '../App.css'

const ProductItem = ({ product }) => {
    const [imageSrc, setImageSrc] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const loadImage = useCallback(async () => {
        try {
            setLoading(true);
            setError(false);
            const cachedImage = await imageCache.getImage(product.imageUrl, {
                priority: 'high'
            });
            setImageSrc(cachedImage);
        } catch (err) {
            console.error('图片加载失败:', err);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [product.imageUrl]);

    const handleRetry = useCallback(async () => {
        try {
            setLoading(true);
            setError(false);
            imageCache.clearFailedUrls();
            await loadImage();
        } catch (err) {
            setError(true);
        }
    }, [loadImage]);

    useEffect(() => {
        loadImage();
    }, [loadImage]);

    return (
        <div className="product-item">
            <div className="product-image-container">
                {loading && (
                    <div className="image-placeholder">
                        <div className="loading-spinner"></div>
                    </div>
                )}
                {error && (
                    <div className="image-placeholder">
                        <div className="error-message">
                            <span>加载失败</span>
                            <button 
                                className="retry-button"
                                onClick={handleRetry}
                            >
                                重试
                            </button>
                        </div>
                    </div>
                )}
                {imageSrc && (
                    <img 
                        src={imageSrc} 
                        alt={product.name}
                        className={`product-image ${!loading ? 'loaded' : ''}`}
                        loading="lazy"
                    />
                )}
            </div>
            <div className="product-details">
                <h3>{product.name}</h3>
                <p className="product-description">{product.description}</p>
                <p className="product-price">¥{product.price.toFixed(2)}</p>
            </div>
        </div>
    );
};

export default ProductItem;    