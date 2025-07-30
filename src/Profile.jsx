// src/Profile.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { db } from './firebase';
import { trackProfileView, trackLinkClick, getVisitorLocation } from './analytics';

// Test function to verify color darkening works
const testColorDarkening = () => {
  const testColors = ['#FF0000', '#00FF00', '#0000FF', '#FFA500', '#800080'];
  console.log('Testing color darkening:');
  testColors.forEach(color => {
    const darkened = darkenColor(color, 0.4);
    console.log(`${color} -> ${darkened}`);
  });
};

// Function to create a darker version of a color
const darkenColor = (hexColor, amount = .1) => {
  // Handle invalid or missing color
  if (!hexColor || typeof hexColor !== 'string') {
    return '#1a1a1a'; // Default dark background
  }
  
  // Remove the # if present
  const hex = hexColor.replace('#', '');
  
  // Validate hex color format
  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
    return '#1a1a1a'; // Default dark background
  }
  
  // Convert to RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Darken by reducing each component
  const darkR = Math.max(0, Math.floor(r * (1 - amount)));
  const darkG = Math.max(0, Math.floor(g * (1 - amount)));
  const darkB = Math.max(0, Math.floor(b * (1 - amount)));
  
  // Convert back to hex
  const darkHex = '#' + 
    darkR.toString(16).padStart(2, '0') + 
    darkG.toString(16).padStart(2, '0') + 
    darkB.toString(16).padStart(2, '0');
  
  return darkHex;
};

// Payment methods configuration
const PAYMENT_METHODS = [
  {
    id: 'cashapp',
    name: 'Cash App',
    icon: '$',
    bgColor: '#00d632',
    textColor: 'white',
    condition: (data, links) => links.cashAppLink || data.cashAppUrl,
    getUrl: (data, links) => links.cashAppLink || data.cashAppUrl
  },
  {
    id: 'paypal',
    name: 'PayPal',
    icon: 'P',
    bgColor: '#ffc439',
    textColor: '#003087',
    condition: (data, links) => links.payPalLink,
    getUrl: (data, links) => links.payPalLink
  },
  {
    id: 'venmo',
    name: 'Venmo',
    icon: 'V',
    bgColor: '#008cff',
    textColor: 'white',
    condition: (data, links) => links.venmoLink,
    getUrl: (data, links) => links.venmoLink
  },
  {
    id: 'applepay',
    name: 'Apple Pay',
    icon: '🍎',
    bgColor: 'white',
    textColor: 'black',
    condition: (data, links) => data.acceptsApplePay,
    getUrl: () => null // Apple Pay doesn't have a direct URL
  },
  {
    id: 'googlepay',
    name: 'Google Pay',
    icon: 'G',
    bgColor: '#000000',
    textColor: 'white',
    condition: (data, links) => data.acceptsGooglePay,
    getUrl: () => null // Google Pay doesn't have a direct URL
  },
  {
    id: 'samsungpay',
    name: 'Samsung Pay',
    icon: 'S',
    bgColor: '#1428a0',
    textColor: 'white',
    condition: (data, links) => data.acceptsSamsungPay,
    getUrl: () => null // Samsung Pay doesn't have a direct URL
  }
];

// Social media links configuration
const SOCIAL_MEDIA_LINKS = [
  {
    id: 'spotify',
    icon: '♪',
    bgColor: '#1db954',
    textColor: 'white',
    condition: (data) => data.spotifyUrl,
    getUrl: (data) => data.spotifyUrl
  },
  {
    id: 'youtube',
    icon: '▶',
    bgColor: '#ff0000',
    textColor: 'white',
    condition: (data) => data.youTubeUrl,
    getUrl: (data) => data.youTubeUrl
  },
  {
    id: 'tiktok',
    icon: '♪',
    bgColor: '#000000',
    textColor: 'white',
    condition: (data) => data.tikTokUrl,
    getUrl: (data) => data.tikTokUrl
  },
  {
    id: 'instagram',
    icon: '📷',
    bgColor: '#e4405f',
    textColor: 'white',
    condition: (data) => data.instagramUrl,
    getUrl: (data) => data.instagramUrl
  },
  {
    id: 'twitter',
    icon: '🐦',
    bgColor: '#1da1f2',
    textColor: 'white',
    condition: (data) => data.twitterUrl,
    getUrl: (data) => data.twitterUrl
  },
  {
    id: 'facebook',
    icon: 'f',
    bgColor: '#1877f2',
    textColor: 'white',
    condition: (data) => data.facebookUrl,
    getUrl: (data) => data.facebookUrl
  }
];

// Function to get active payment methods
const getActivePaymentMethods = (data, links) => {
  return PAYMENT_METHODS.filter(method => method.condition(data, links));
};

// Function to get active social media links
const getActiveSocialMediaLinks = (data) => {
  return SOCIAL_MEDIA_LINKS.filter(link => link.condition(data));
};

// Single reusable payment method component
const PaymentMethodItem = ({ method, data, links, onLinkClick, isLast }) => {
  const url = method.getUrl(data, links);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: isLast ? '0.75rem 0 0 0' : '0.75rem 0',
          cursor: url ? 'pointer' : 'default',
          transition: 'transform 0.2s ease'
        }}
        onClick={() => url && onLinkClick(method.id, url)}
        onMouseEnter={(e) => url && (e.target.style.transform = 'translate(0, -2px)')}
        onMouseLeave={(e) => url && (e.target.style.transform = 'translate(0, 0)')}
      >
        <div style={{
          width: '60px',
          height: '40px',
          backgroundColor: method.bgColor,
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <span style={{ 
            color: method.textColor, 
            fontSize: '20px', 
            fontWeight: 'bold' 
          }}>
            {method.icon}
          </span>
        </div>
        <span style={{ 
          color: 'white', 
          fontSize: '16px', 
          fontWeight: 'bold',
          wordBreak: 'break-word'
        }}>
          {method.name}
        </span>
      </div>
      {!isLast && (
        <div style={{
          width: 'calc(100% - 76px)',
          height: '1px',
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          marginLeft: '76px'
        }} />
      )}
    </div>
  );
};

// Single reusable social media link component
const SocialMediaLink = ({ link, data, onLinkClick }) => {
  const url = link.getUrl(data);
  
  return (
    <div style={{
      width: '32px',
      height: '32px',
      backgroundColor: link.bgColor,
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'transform 0.2s ease',
      flexShrink: 0
    }} 
    onClick={() => onLinkClick(link.id, url)}
    onMouseEnter={(e) => e.target.style.transform = 'scale(1.1)'}
    onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
    >
      <span style={{ color: link.textColor, fontSize: '16px', fontWeight: 'bold' }}>
        {link.icon}
      </span>
    </div>
  );
};

export default function Profile() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const [d, setD] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedColor, setCopiedColor] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Test color darkening on component mount
  useEffect(() => {
    testColorDarkening();
  }, []);

  useEffect(() => {
    if (!uid) return;

    // Set up real-time listener for profile changes
    const unsubscribe = onSnapshot(
      doc(db, 'recipients', uid),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log('Profile: Received update:', data);
          console.log('Profile: Banner colors in update:', data.bannerColors);
          setD(data);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to profile changes:', error);
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [uid]);

  // Separate effect for tracking profile views to avoid double counting
  useEffect(() => {
    let hasTracked = false;
    
    const trackView = async () => {
      // Only track if:
      // 1. We have a uid
      // 2. We haven't tracked yet in this session
      // 3. Current user is not the profile owner (or no current user)
      if (uid && !hasTracked && (!currentUser || currentUser.uid !== uid)) {
        hasTracked = true;
        console.log('Tracking profile view for:', { uid, currentUser: currentUser?.uid || 'anonymous' });
        try {
          const visitorLocation = await getVisitorLocation();
          await trackProfileView(uid, visitorLocation);
        } catch (error) {
          console.error('Error tracking profile view:', error);
        }
      } else {
        console.log('Not tracking profile view:', { uid, hasTracked, isOwner: currentUser?.uid === uid });
      }
    };

    // Track for both authenticated and anonymous users
    // We need to wait a bit for auth state to settle, but also handle anonymous users
    const timer = setTimeout(() => {
      trackView();
    }, 100);

    return () => clearTimeout(timer);
  }, [uid, currentUser]);

  const handleEdit = () => {
    navigate(`/profile/${uid}/edit`); 
  };

  // Handle link clicks with analytics tracking
  const handleLinkClick = (linkType, linkValue) => {
    console.log('Link clicked:', {
      linkType,
      linkValue,
      currentUser: currentUser?.uid,
      profileUid: uid
    });

    let url = linkValue;
    if (linkType === 'venmo') {
      url = `https://venmo.com/u/${linkValue.replace(/^@/, '')}`;
    } else if (linkType === 'paypal') {
      url = `https://paypal.me/${linkValue.replace(/^@/, '')}`;
    } else if (linkType === 'cashapp') {
      url = `https://cash.app/${linkValue.replace(/^\$/, '')}`;
    }
    
    // Open the link first to preserve the user gesture
    window.open(url, '_blank', 'noopener,noreferrer');

    // Track the click (only if not the profile owner) without blocking the link
    if (!currentUser || currentUser.uid !== uid) {
      console.log('Tracking link click for non-owner');
      (async () => {
        let visitorLocation = { location: 'Unknown' };
        try {
          visitorLocation = await getVisitorLocation();
        } catch (error) {
          // Location fetch failures shouldn't prevent analytics
          console.error('Error getting visitor location:', error);
        }
        try {
          await trackLinkClick(uid, linkType, url, visitorLocation);
        } catch (error) {
          console.error('Error tracking link click:', error);
        }
      })();
    } else {
      console.log('Not tracking - user is profile owner');
    }
  };

  if (loading) return <p>Loading…</p>;
  if (!d) return <p>Profile not found</p>;

  // Debug logging
  console.log('Profile data:', d);
  console.log('Banner colors:', d.bannerColors);
  console.log('Banner URL:', d.profileBannerUrl);
  console.log('Has banner colors:', d.bannerColors && d.bannerColors.length > 0);

  const canEdit = currentUser && currentUser.uid === uid;

  const venmoLink = d.venmoUsername
    ? `https://venmo.com/${d.venmoUsername.replace(/^@/, '')}`
    : d.venmoUrl;
  const cashAppLink = d.cashAppUsername
    ? `https://cash.app/$${d.cashAppUsername.replace(/^\$+/, '')}`
    : d.cashAppUrl;
  const payPalLink = d.payPalUsername
    ? `https://paypal.me/${d.payPalUsername.replace(/^@/, '')}`
    : d.payPalUrl;

      // Get the primary color from banner colors or use a default
      const primaryColor = d.bannerColors && d.bannerColors.length > 0 ? d.bannerColors[0] : '#008080';
      const secondaryColor = d.bannerColors && d.bannerColors.length > 0 ? d.bannerColors[1] : '#008080';
      const tertiaryColor = d.bannerColors && d.bannerColors.length > 0 ? d.bannerColors[2] : '#008080';
      const darkerPrimaryColor = darkenColor(primaryColor, 0.7);
      const darkerSecondaryColor = darkenColor(secondaryColor, 0.7);

      // If no banner colors, use a subtle gradient based on the theme color
      const fallbackBackground = d.themeColor ? darkenColor(d.themeColor, 0.5) : '#1a1a1a';
      const finalBackgroundColor = d.bannerColors && d.bannerColors.length > 0 ? darkerPrimaryColor : fallbackBackground;
      
      // Debug logging for colors
      console.log('Profile background colors:', {
        bannerColors: d.bannerColors,
        primaryColor,
        darkerPrimaryColor,
        themeColor: d.themeColor,
        finalBackgroundColor
      });

      return (
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        width: '100%',
        boxSizing: 'border-box',
        backgroundColor: 'transparent',
        minHeight: '100vh'
      }}>
        {/* Spacer to account for sticky navbar */}
        <div style={{ height: '30px' }}></div>

      {/* Main content - responsive layout */}
      <div className="profile-container" style={{
        display: 'grid',
        gridTemplateColumns: '1fr 2fr',
        gap: '2rem',
        alignItems: 'start'
      }}>
        {/* Left Column - Profile Information */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          width: '100%'
        }}>
          <h2 style={{
            margin: '0',
            color: '#a8a8a5',
            fontSize: '18px',
            fontWeight: '600'
          }}>
            Profile
          </h2>
          {/* Introduction Section with Banner Background */}
          <div style={{
            position: 'relative',
            borderRadius: '30px',
            overflow: 'hidden',
            marginBottom: '1rem',
            width: '100%',
            maxWidth: '100%',
            backgroundColor: secondaryColor,
            border: `1px solid ${tertiaryColor}`
          }}>
            {/* Banner Background */}
            {d.profileBannerUrl && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: '20vh',
                backgroundImage: `url(${d.profileBannerUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(6px)',
                transform: 'scale(1.1)'
              }} />
            )}
            
            {/* Gradient overlay that transitions from banner to secondary color */}
            <div style={{
              position: 'absolute',
              margin: '.2%',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: `linear-gradient(to bottom, 
                ${darkerSecondaryColor}00 0%,  
                ${darkerSecondaryColor} 70%,
                ${darkerSecondaryColor} 100%)`
            }} />
            
            {/* Content overlay */}
            <div style={{
              position: 'relative',
              zIndex: 2,
              padding: '5%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              gap: '1.3rem',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '1.5rem',
                width: '100%'
              }}>
                                  <img 
                    src={d.profileImageUrl || '/default-avatar.jpg'} 
                    alt="profile" 
                    className="profile-image"
                    style={{
                      width: 'clamp(60px, 16vw, 130px)',
                      height: 'clamp(70px, 18vw, 150px)',
                      borderRadius: '20px',
                      objectFit: 'cover',
                      flexShrink: 0
                    }}
                  />
                <div style={{
                  flex: 1,
                  minWidth: 0
                }}>
                  <h1 style={{
                    margin: '0 0 0 0',
                    color: 'white',
                    fontSize: 'clamp(1.5rem, 4vw, 2rem)',
                    fontWeight: 'bold',
                    lineHeight: '.6',
                    wordBreak: 'break-word'
                  }}>
                    {d.firstName}
                  </h1>
                  {d.altName && (
                    <p style={{
                      margin: '0 0 0.25rem 0',
                      color: '#949494',
                      fontSize: 'clamp(1.5rem, 4vw, 2rem)',
                      wordBreak: 'break-word'
                    }}>
                      {d.lastName}
                    </p>
                  )}
                </div>
              </div>
              
              {d.description && (
                <p style={{
                  margin: 0,
                  color: '#d0d0d0',
                  fontSize: '14px',
                  fontWeight: '600',
                  lineHeight: '1.5',
                  textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                  maxWidth: '100%',
                  wordBreak: 'break-word'
                }}>
                  {d.description}
                </p>
              )}

              {/* Social Media Links */}
              <div style={{
                display: 'flex',
                gap: '1rem',
                alignItems: 'center',
                marginTop: '0.5rem',
                flexWrap: 'wrap'
              }}>
                {getActiveSocialMediaLinks(d).map((link) => (
                  <SocialMediaLink
                    key={link.id}
                    link={link}
                    data={d}
                    onLinkClick={handleLinkClick}
                  />
                ))}
              </div>

              {/* Divider Line */}
                <div style={{
                  width: '98%',
                  height: '1.5px',
                  margin: '0 2%',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                }} />

              {/* Tipping Links */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0',
                width: '100%'
              }}>
                <h2 style={{
                  margin: '0 0 .8rem 0',
                  color: '#a8a8a5',
                  fontSize: '18px',
                  fontWeight: '600',
                  textAlign: 'left',
                  lineHeight: '.6'
                }}>
                  Tip {d.firstName}
                </h2>
                {getActivePaymentMethods(d, { cashAppLink, payPalLink, venmoLink }).map((method, index, array) => (
                  <PaymentMethodItem
                    key={method.id}
                    method={method}
                    data={d}
                    links={{ cashAppLink, payPalLink, venmoLink }}
                    onLinkClick={handleLinkClick}
                    isLast={index === array.length - 1}
                  />
                ))}
              </div>

              {/* Divider Line */}
              <div style={{
                  width: '98%',
                  height: '1.5px',
                  margin: '0 2%',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                }} />

              {/* Thought Section */}
              <div style={{

                width: '100%'
              }}>
                <h2 style={{
                  margin: '0 0 1rem 0',
                  color: '#a8a8a5',
                  fontSize: '18px',
                  fontWeight: '600'
                }}>
                  Thought
                </h2>
                <div style={{
                  backgroundColor: `${secondaryColor}`,
                  borderRadius: '20px',
                  padding: '1rem',
                  position: 'relative',
                  backdropFilter: 'blur(5px)'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '-8px',
                    left: '1rem',
                    fontSize: '20px',
                    color: '#888'
                  }}>
                    "
                  </div>
                  <p style={{
                    margin: '0.5rem 0 0 0',
                    color: '#d2cecc',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    fontStyle: 'italic',
                    wordBreak: 'break-word'
                  }}>
                    Nothing soothes the chaos in my head like screaming into a mic - thanks for listening, even when it gets loud.
                  </p>
                  <p style={{
                    margin: '1rem 0 0 0',
                    color: '#888',
                    fontSize: '12px',
                    fontWeight: '600',
                    textAlign: 'right',
                    wordBreak: 'break-word'
                  }}>
                    {d.firstName.toUpperCase()} {d.lastName.toUpperCase()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Edit Profile Button */}
          {canEdit && (
            <button 
              onClick={handleEdit}
              style={{
                background: '#ea8151',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '25px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                width: '100%'
              }}
            >
              Edit Profile
            </button>
          )}
        </div>

        {/* Right Column - Gallery */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          width: '100%'
        }}>
          {/* Gallery Section */}
          {!!d.images?.length && (
            <div style={{
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <h2 style={{
                margin: '0 0 1rem 0',
                color: '#a8a8a5',
                fontSize: '18px',
                fontWeight: '600'
              }}>
                Gallery
              </h2>
              
              <div style={{ width: '100%', overflow: 'hidden', maxWidth: '600px' }}>
                <div 
                  className="gallery-scroll"
                  style={{
                    display: 'flex',
                    overflowX: 'auto',
                    gap: '1rem',
                    paddingBottom: '0.5rem',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                >
                  {d.images.map((url, i) => (
                    <img 
                      key={i} 
                      src={url} 
                      alt=""
                      style={{
                        width: '240px',
                        height: '270px',
                        borderRadius: '30px',
                        objectFit: 'cover',
                        flexShrink: 0
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Videos Section - Placeholder for future implementation */}
          <div style={{
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <h2 style={{
              margin: '0 0 1rem 0',
              color: '#a8a8a5',
              fontSize: '18px',
              fontWeight: '600'
            }}>
              Videos
            </h2>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '1rem'
            }}>
              <div style={{
                width: '100%',
                aspectRatio: '16/9',
                backgroundColor: 'rgba(64, 64, 64, 0.8)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#888',
                fontSize: '14px',
                backdropFilter: 'blur(5px)'
              }}>
                Video 1
              </div>
              <div style={{
                width: '100%',
                aspectRatio: '16/9',
                backgroundColor: 'rgba(64, 64, 64, 0.8)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#888',
                fontSize: '14px',
                backdropFilter: 'blur(5px)'
              }}>
                Video 2
              </div>
            </div>
          </div>

          {/* Calendar Section - Placeholder for future implementation */}
          <div style={{
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <h2 style={{
              margin: '0 0 1rem 0',
              color: '#a8a8a5',
              fontSize: '18px',
              fontWeight: '600'
            }}>
              Events
            </h2>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem'
            }}>
              <div style={{
                backgroundColor: 'rgba(64, 64, 64, 0.8)',
                borderRadius: '8px',
                padding: '1rem',
                textAlign: 'center',
                backdropFilter: 'blur(5px)'
              }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: 'white', fontSize: '14px' }}>April</h4>
                <div style={{ color: '#888', fontSize: '12px' }}>Calendar Placeholder</div>
              </div>
              <div style={{
                backgroundColor: 'rgba(64, 64, 64, 0.8)',
                borderRadius: '8px',
                padding: '1rem',
                textAlign: 'center',
                backdropFilter: 'blur(5px)'
              }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: 'white', fontSize: '14px' }}>May</h4>
                <div style={{ color: '#888', fontSize: '12px' }}>Calendar Placeholder</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile responsive styles */}
      <style>{`
        body {
          background: linear-gradient(to bottom, ${finalBackgroundColor}, ${darkenColor(primaryColor, 0.8)}) !important;
          margin: 0;
          padding: 0;
          transition: background 0.3s ease;
          min-height: 100vh;
        }
        
        /* Ensure smooth transitions when background color changes */
        .profile-container {
          transition: background-color 0.3s ease;
        }
        
        /* Gallery scrollbar styling */
        .gallery-scroll::-webkit-scrollbar {
          height: 6px;
        }
        
        .gallery-scroll::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }
        
        .gallery-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 3px;
        }
        
        .gallery-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.5);
        }
        
        @media (max-width: 768px) {
          .profile-container {
            grid-template-columns: 1fr !important;
            gap: 1rem !important;
          }
          
          /* Ensure no horizontal scrolling on mobile */
          body {
            overflow-x: hidden;
          }
          
          /* Make sure all content fits within viewport */
          .profile-container > div {
            width: 100% !important;
            max-width: 100vw !important;
            box-sizing: border-box !important;
          }
          
          /* Adjust padding for mobile */
          .profile-container {
            padding: 0 !important;
          }
          
          /* Profile image sizing for mobile */
          .profile-image {
            width: clamp(60px, 16vw, 130px) !important;
            height: clamp(70px, 18vw, 150px) !important;
            min-width: 60px !important;
            min-height: 70px !important;
          }
        }
        
        @media (max-width: 480px) {
          /* Further adjustments for very small screens */
          .profile-container {
            gap: 0.5rem !important;
          }
          
          /* Profile image on very small screens */
          .profile-image {
            width: clamp(60px, 20vw, 100px) !important;
            height: clamp(70px, 22vw, 120px) !important;
            min-width: 60px !important;
            min-height: 70px !important;
          }
        }
      `}</style>
    </div>
  );
}
