import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [products, setProducts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);

  // Configuration
  const SHOPIFY_DOMAIN = 'j0dktb-z1.myshopify.com';
  const STOREFRONT_ACCESS_TOKEN = 'eeae7a5247421a8b8a14711145ecd93b'; // Fixed token
  const RAZORPAY_KEY_ID = 'rzp_live_NIogFPd28THyOF'; // Your live key
  const API_BASE_URL = process.env.REACT_APP_BACKEND_URL ? `${process.env.REACT_APP_BACKEND_URL}/api` : '/api';

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // Beautiful Indian fashion hero images
  const heroImages = [
    {
      url: "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb",
      alt: "Vibrant red saree with traditional jewelry"
    },
    {
      url: "https://images.unsplash.com/photo-1571908599407-cdb918ed83bf",
      alt: "Elegant cream ethnic outfit in boutique setting"
    },
    {
      url: "https://images.unsplash.com/photo-1619715613791-89d35b51ff81",
      alt: "Green traditional outfit with modern styling"
    }
  ];

  // Fetch products from Shopify
  const fetchShopifyProducts = async () => {
    const query = `
      {
        products(first: 12) {
          edges {
            node {
              id
              title
              handle
              description
              images(first: 1) {
                edges {
                  node {
                    url
                    altText
                  }
                }
              }
              variants(first: 1) {
                edges {
                  node {
                    id
                    price {
                      amount
                      currencyCode
                    }
                    compareAtPrice {
                      amount
                      currencyCode
                    }
                    availableForSale
                  }
                }
              }
              vendor
              productType
            }
          }
        }
      }
    `;

    try {
      const response = await fetch(`https://${SHOPIFY_DOMAIN}/api/2024-01/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': STOREFRONT_ACCESS_TOKEN,
        },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();
      if (data.data && data.data.products) {
        setProducts(data.data.products.edges.map(edge => edge.node));
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShopifyProducts();
  }, []);

  // Auto-rotate hero images
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) =>
        (prevIndex + 1) % heroImages.length
      );
    }, 5000);

    return () => clearInterval(interval);
  }, [heroImages.length]);

  // Cart functions
  const addToCart = (product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
    alert('Product added to cart!');
  };

  const removeFromCart = (productId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity === 0) {
      removeFromCart(productId);
      return;
    }

    setCart(prevCart =>
      prevCart.map(item =>
        item.id === productId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => {
      const price = parseFloat(item.variants.edges[0]?.node.price.amount || 0);
      return total + (price * item.quantity);
    }, 0);
  };

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const debugLog = (message, data) => {
    console.log(`[DEBUG] ${message}:`, data);
  };

  // Payment processing
  const processPayment = async () => {
    const totalAmount = getTotalAmount();
    debugLog('Starting payment process', {
      totalAmount,
      cartItems: cart.length,
      apiUrl: API_BASE_URL
    });

    if (totalAmount === 0) {
      alert('Please add items to cart');
      return;
    }

    try {
      const orderResponse = await fetch(`${API_BASE_URL}/create-razorpay-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(totalAmount * 100),
          currency: 'INR',
          cart: cart.map(item => ({
            id: item.id,
            title: item.title,
            quantity: item.quantity,
            price: parseFloat(item.variants.edges[0]?.node.price.amount || 0),
            handle: item.handle
          }))
        }),
      });

      // Log for debugging
      console.log('Response status:', orderResponse.status);
      const responseText = await orderResponse.text();
      console.log('Raw response text:', responseText);

      if (!orderResponse.ok) {
        throw new Error('Failed to create order');
      }

      const orderData = JSON.parse(responseText);

      // Razorpay payment options
      const options = {
        key: RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Undhyu.com',
        description: 'Authentic Indian Fashion',
        order_id: orderData.id,
        handler: async function (response) {
          // Close the cart immediately to show progress
          setShowCart(false);
          // Show loading state
          alert('Processing payment... Please wait.');

          try {
            // Verify payment
            const verifyResponse = await fetch(`${API_BASE_URL}/verify-payment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                cart: cart.map(item => ({
                  id: item.id,
                  title: item.title,
                  quantity: item.quantity,
                  price: parseFloat(item.variants.edges[0]?.node.price.amount || 0),
                  handle: item.handle
                }))
              }),
            });

            const result = await verifyResponse.json();

            if (result.success) {
              // Clear cart and show success
              setCart([]);
              alert('🎉 Payment successful! Your order has been placed successfully. You will receive confirmation shortly.');
            } else {
              alert('❌ Payment verification failed. Please contact our support team with payment ID: ' + response.razorpay_payment_id);
            }
          } catch (error) {
            console.error('Payment verification error:', error);
            alert('❌ Payment verification failed. Please contact our support team with payment ID: ' + response.razorpay_payment_id);
          }
        },
        prefill: {
          name: '',
          email: '',
          contact: ''
        },
        theme: {
          color: '#ea580c'
        },
        modal: {
          ondismiss: function () {
            console.log('Payment cancelled');
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      console.error('Payment error:', error);
      alert('Failed to process payment. Please try again.');
    }
  };

  const formatPrice = (price) => {
    if (!price) return '';
    return `₹${parseFloat(price.amount).toLocaleString('en-IN')}`;
  };

  const ProductCard = ({ product }) => {
    const image = product.images.edges[0]?.node;
    const variant = product.variants.edges[0]?.node;
    const hasDiscount = variant?.compareAtPrice;

    return (
      <div className="product-card group bg-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 overflow-hidden">
        {image && (
          <div className="relative aspect-w-3 aspect-h-4 bg-gray-200">
            <img
              src={image.url}
              alt={image.altText || product.title}
              className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-500"
            />
            {hasDiscount && (
              <div className="absolute top-3 left-3 bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">
                SALE
              </div>
            )}
          </div>
        )}

        <div className="p-4">
          <h3 className="font-semibold text-gray-800 mb-2 line-clamp-2 text-sm">
            {product.title}
          </h3>

          {variant && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg font-bold text-orange-600">
                {formatPrice(variant.price)}
              </span>
              {variant.compareAtPrice && (
                <span className="text-sm text-gray-500 line-through">
                  {formatPrice(variant.compareAtPrice)}
                </span>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => addToCart(product)}
              disabled={!variant?.availableForSale}
              className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors text-sm font-semibold disabled:bg-gray-400"
            >
              {variant?.availableForSale ? 'Add to Cart' : 'Out of Stock'}
            </button>
            <button
              onClick={() => window.open(`https://${SHOPIFY_DOMAIN}/products/${product.handle}`, '_blank')}
              className="flex-1 border border-orange-600 text-orange-600 px-4 py-2 rounded-lg hover:bg-orange-50 transition-colors text-sm font-semibold"
            >
              View Details
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-orange-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-3xl font-bold text-gray-900">
                Undhyu<span className="text-orange-600">.</span>
              </h1>
              <span className="ml-2 text-sm text-gray-600 italic">Authentic Indian Fashion</span>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowCart(true)}
                className="relative bg-orange-600 text-white px-6 py-2 rounded-full hover:bg-orange-700 font-semibold"
              >
                Cart ({getTotalItems()})
                {getTotalItems() > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                    {getTotalItems()}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative h-96 md:h-[600px] overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImages[currentImageIndex].url}
            alt={heroImages[currentImageIndex].alt}
            className="w-full h-full object-cover transition-all duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent"></div>
        </div>

        <div className="relative z-10 h-full flex items-center">
          <div className="max-w-7xl mx-auto px-6 w-full">
            <div className="max-w-2xl text-white">
              <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
                Undhyu<span className="text-orange-400">.</span>
              </h1>
              <p className="text-xl md:text-2xl mb-4 opacity-90">
                Explore Wide Range of Indian Sarees
              </p>
              <p className="text-lg mb-8 opacity-80">
                Traditional and ready-made साड़ी, perfect for weddings, festivals, parties and special occasions
              </p>
            </div>
          </div>
        </div>

        {/* Image indicators */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-2">
          {heroImages.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentImageIndex(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentImageIndex ? 'bg-white' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      </section>

      {/* Products Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Featured Products</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Discover our handpicked selection of authentic Indian fashion pieces
            </p>
          </div>

          {loading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading beautiful collections...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Cart Sidebar */}
      {showCart && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowCart(false)}></div>
          <div className="absolute right-0 top-0 h-full w-96 bg-white shadow-xl overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Shopping Cart</h3>
                <button
                  onClick={() => setShowCart(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              {cart.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Your cart is empty</p>
              ) : (
                <>
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 mb-4 p-4 border rounded-lg">
                      <img
                        src={item.images.edges[0]?.node.url}
                        alt={item.title}
                        className="w-16 h-16 object-cover rounded"
                      />
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm">{item.title}</h4>
                        <p className="text-orange-600 font-bold">
                          {formatPrice(item.variants.edges[0]?.node.price)}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}

                  <div className="border-t pt-4 mt-6">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-lg font-bold">Total:</span>
                      <span className="text-xl font-bold text-orange-600">
                        ₹{getTotalAmount().toLocaleString('en-IN')}
                      </span>
                    </div>
                    <button
                      onClick={processPayment}
                      className="w-full bg-orange-600 text-white py-3 rounded-lg font-semibold hover:bg-orange-700 transition-colors"
                    >
                      Pay with Razorpay
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p>&copy; 2025 Undhyu.com - Authentic Indian Fashion. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
