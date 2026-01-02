/**
 * Dressify Frontend Logic
 * Handles product fetching, routing, and cart interactions.
 */

const app = {
    // API Configuration
    apiBase: '/api',

    // State
    state: {
        products: [],
        productsByCategory: {},
        cart: [],
        currentView: 'home'
    },

    // Category display config
    categoryConfig: {
        'Shirts': { icon: '👔', color: '#6366f1' },
        'Tshirts': { icon: '👕', color: '#ec4899' },
        'Jeans': { icon: '👖', color: '#3b82f6' },
        'Kurtas': { icon: '👘', color: '#f59e0b' },
        'Watches': { icon: '⌚', color: '#14b8a6' },
        'Casual Shoes': { icon: '👟', color: '#8b5cf6' },
        'Sports Shoes': { icon: '🏃', color: '#10b981' },
        'Flip Flops': { icon: '🩴', color: '#f97316' },
        'Sandals': { icon: '👡', color: '#e11d48' },
        'Heels': { icon: '👠', color: '#be185d' },
        'Tops': { icon: '👚', color: '#db2777' },
        'Dresses': { icon: '👗', color: '#c026d3' },
        'Handbags': { icon: '👜', color: '#7c3aed' },
        'Sunglasses': { icon: '🕶️', color: '#0ea5e9' },
        'default': { icon: '🛍️', color: '#64748b' }
    },

    // Initialization
    init() {
        console.log('✨ Dressify initialized');
        this.fetchProductsByCategory();

        // Check URL params for deep linking
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('product');
        if (productId) {
            this.showProductDetail(productId);
        }
    },

    // Navigation
    navigate(viewName) {
        document.querySelectorAll('.view').forEach(el => {
            el.classList.remove('active');
            setTimeout(() => {
                if (!el.classList.contains('active')) el.classList.add('hidden');
            }, 300);
        });

        const target = document.getElementById(`${viewName}-view`);
        if (target) {
            target.classList.remove('hidden');
            setTimeout(() => target.classList.add('active'), 10);
            this.state.currentView = viewName;
            window.scrollTo(0, 0);
        }
    },

    scrollToShop() {
        this.navigate('home');
        setTimeout(() => {
            document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
        }, 100);
    },

    backToChat() {
        // Navigate home first, then open chat
        this.navigate('home');
        setTimeout(() => {
            document.getElementById('chat-icon').click();
        }, 100);
    },

    // Data Fetching
    async fetchProductsByCategory() {
        const container = document.getElementById('category-sections');
        const loader = document.getElementById('products-loading');

        try {
            const response = await fetch(`${this.apiBase}/products/by-category?items_per_category=8`);
            const categories = await response.json();
            this.state.productsByCategory = categories;

            // Flatten for local state lookup
            Object.values(categories).forEach(items => {
                this.state.products.push(...items);
            });

            loader.classList.add('hidden');
            container.innerHTML = Object.entries(categories)
                .map(([cat, items]) => this.createCategorySection(cat, items))
                .join('');

        } catch (error) {
            console.error('Failed to fetch products:', error);
            loader.innerHTML = '<p style="text-align:center; color: var(--text-secondary)">Failed to load products. Please try again later.</p>';
        }
    },

    async fetchProductDetails(id) {
        try {
            const response = await fetch(`${this.apiBase}/products/${id}`);
            if (!response.ok) throw new Error('Product not found');
            return await response.json();
        } catch (error) {
            console.error('Error fetching details:', error);
            return null;
        }
    },

    // UI Rendering
    createCategorySection(categoryName, products) {
        const config = this.categoryConfig[categoryName] || this.categoryConfig['default'];

        return `
            <section class="category-section">
                <div class="category-header-bar">
                    <span class="cat-icon">${config.icon}</span>
                    <h2>${categoryName}</h2>
                    <span class="item-count">${products.length} items</span>
                </div>
                <div class="category-products">
                    ${products.map(p => this.createProductCard(p)).join('')}
                </div>
            </section>
        `;
    },

    createProductCard(product) {
        const imgUrl = product.thumbnail_url ? `/images/${product.image_id}.jpg` : 'https://placehold.co/300x400?text=No+Image';

        return `
            <div class="grid-product-card" onclick="app.showProductDetail('${product.image_id}')">
                <img src="${imgUrl}" 
                     class="grid-product-img" 
                     loading="lazy"
                     alt="${product.article_type || 'Product'}"
                     onerror="this.src='https://placehold.co/300x400?text=Image+Error'">
                <div class="grid-product-info">
                    <div class="grid-product-brand">${product.brand || 'Unbranded'}</div>
                    <div class="grid-product-title">${product.title || product.product_display_name || 'Fashion Item'}</div>
                    <div class="grid-product-price">$${product.price || ((Math.random() * 50 + 20).toFixed(2))}</div>
                </div>
            </div>
        `;
    },

    async showProductDetail(id) {
        let product = this.state.products.find(p => p.image_id == id);

        if (!product) {
            product = await this.fetchProductDetails(id);
        }

        if (!product) {
            alert('Product not found!');
            return;
        }

        const imgUrl = product.thumbnail_url ? `/images/${product.image_id}.jpg` : 'https://placehold.co/400x500';

        document.getElementById('detail-image').src = imgUrl;
        document.getElementById('detail-title').innerText = product.title || product.product_display_name;
        document.getElementById('detail-brand').innerText = product.brand;
        document.getElementById('detail-price').innerText = '$' + (product.price || (Math.random() * 50 + 20).toFixed(2));
        document.getElementById('detail-desc').innerText = `${product.snippet || product.product_display_name || ''}. ${product.article_type} in ${product.color || product.base_colour}. Perfect for your collection.`;
        document.getElementById('detail-color').innerText = product.color || product.base_colour || 'N/A';

        document.getElementById('detail-gender').innerText = product.gender || 'Unisex';
        document.getElementById('detail-category').innerText = product.article_type || 'Fashion';

        this.navigate('product');
    },

    // Cart Logic
    addToCart() {
        const toast = document.getElementById('toast');
        toast.classList.remove('hidden');

        const count = parseInt(document.getElementById('cart-btn').innerText.match(/\d+/)[0]) + 1;
        document.getElementById('cart-btn').innerText = `Cart (${count})`;

        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }
};

// Start App when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

// Expose to window for global access
window.app = app;
