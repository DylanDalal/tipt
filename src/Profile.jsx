// src/Profile.jsx
import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { db } from './firebase';
import { trackProfileView, trackLinkClick, getVisitorLocation } from './analytics';
import { CalendarDisplay } from './Calendar';

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
    logo: '/profile_logos/cashapp.png',
    bgColor: '#00d632',
    condition: (data, links) => links.cashAppLink || data.cashAppUrl,
    getUrl: (data, links) => links.cashAppLink || data.cashAppUrl
  },
  {
    id: 'paypal',
    name: 'PayPal',
    logo: '/profile_logos/paypal.png',
    bgColor: '#ffc439',
    condition: (data, links) => links.payPalLink,
    getUrl: (data, links) => links.payPalLink
  },
  {
    id: 'venmo',
    name: 'Venmo',
    logo: '/profile_logos/venmo.png',
    bgColor: '#008cff',
    condition: (data, links) => links.venmoLink,
    getUrl: (data, links) => links.venmoLink
  },
  {
    id: 'applepay',
    name: 'Apple Pay',
    logo: '/profile_logos/apple_pay.png',
    bgColor: 'white',
    condition: (data, links) => data.acceptsApplePay,
    getUrl: () => null // Apple Pay doesn't have a direct URL
  },
  {
    id: 'googlepay',
    name: 'Google Pay',
    logo: '/profile_logos/google_pay.png',
    bgColor: '#000000',
    condition: (data, links) => data.acceptsGooglePay,
    getUrl: () => null // Google Pay doesn't have a direct URL
  },
  {
    id: 'samsungpay',
    name: 'Samsung Pay',
    logo: '/profile_logos/samsung_pay.png',
    bgColor: '#1e4bc6',
    condition: (data, links) => data.acceptsSamsungPay,
    getUrl: () => null // Samsung Pay doesn't have a direct URL
  }
];

// Social media links configuration
const SOCIAL_MEDIA_LINKS = [
  {
    id: 'spotify',
    logo: '/profile_logos/spotify.png',
    condition: (data) => data.spotifyUrl,
    getUrl: (data) => data.spotifyUrl
  },
  {
    id: 'youtube',
    logo: '/profile_logos/youtube.png',
    condition: (data) => data.youTubeUrl,
    getUrl: (data) => data.youTubeUrl
  },
  {
    id: 'tiktok',
    logo: '/profile_logos/tiktok.png',
    condition: (data) => data.tikTokUrl,
    getUrl: (data) => data.tikTokUrl
  },
  {
    id: 'instagram',
    logo: '/profile_logos/instagram.png',
    condition: (data) => data.instagramUrl,
    getUrl: (data) => data.instagramUrl
  },
  {
    id: 'twitter',
    logo: '/profile_logos/twitter.png',
    condition: (data) => data.twitterUrl,
    getUrl: (data) => data.twitterUrl
  },
  {
    id: 'facebook',
    logo: '/profile_logos/facebook.png',
    condition: (data) => data.facebookUrl,
    getUrl: (data) => data.facebookUrl
  }
];

// Action icons configuration
const ACTION_ICONS = [
  {
    id: 'camera',
    logo: '/profile_logos/camera.png',
    condition: () => true, // Always show
    getUrl: () => null
  },
  {
    id: 'like',
    logo: '/profile_logos/heart.png',
    condition: () => true, // Always show
    getUrl: () => null
  },
  {
    id: 'share',
    logo: '/profile_logos/share.png',
    condition: () => true, // Always show
    getUrl: () => null
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

// Function to get active action icons
const getActiveActionIcons = (data) => {
  return ACTION_ICONS.filter(icon => icon.condition(data));
};

// Reusable payment method component
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
          height: '30px',
          backgroundColor: method.bgColor,
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          padding: '6px'
        }}>
          <img 
            src={method.logo} 
            alt={method.name}
            style={{
              width: '90%',
              height: '90%',
              objectFit: 'contain',
            }}
          />
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
      <img 
        src={link.logo} 
        alt={link.id}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain'
        }}
      />
    </div>
  );
};

// Single reusable action icon component
const ActionIcon = ({ icon, data, onLinkClick }) => {
  const url = icon.getUrl(data);
  
  return (
    <div style={{
      width: '25px',
      height: '25px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      opacity: '0.6',
      transition: 'opacity 0.3s ease',
      flexShrink: 0
    }} 
    onClick={() => onLinkClick(icon.id, url)}
          onMouseEnter={(e) => e.target.style.opacity = '1'}
      onMouseLeave={(e) => e.target.style.opacity = '0.6'}
    >
      <img 
        src={icon.logo} 
        alt={icon.id}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain'
        }}
      />
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
  const [scrollY, setScrollY] = useState(0);
  const [currentGalleryIndex, setCurrentGalleryIndex] = useState(0);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const bannerRef = useRef(null);

  // Calendar navigation function
  const navigateCalendarMonths = (direction) => {
    const newMonth = new Date(calendarMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);
    setCalendarMonth(newMonth);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Parallax effect for banner background
  useEffect(() => {
    const handleScroll = () => {
      // Responsive parallax - more pronounced on mobile
      const isMobile = window.innerWidth <= 900;
      const parallaxMultiplier = isMobile ? 0.2 : 0.1; // Double the effect on mobile
      const parallaxOffset = window.scrollY * parallaxMultiplier;
      setScrollY(parallaxOffset);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true }); // Recalculate on resize
    handleScroll(); // Initial call

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  // Test color darkening on component mount
  useEffect(() => {
    testColorDarkening();
  }, []);

  // Initialize calendar month when events are loaded
  useEffect(() => {
    if (d?.events && d.events.length > 0) {
      // Find the first event date
      const firstEventDate = new Date(Math.min(...d.events.map(e => new Date(e.startTime))));
      const startMonth = new Date(firstEventDate.getFullYear(), firstEventDate.getMonth(), 1);
      
      setCalendarMonth(startMonth);
    }
  }, [d?.events]);

  // Handle gallery scroll to update current index
  const handleGalleryScroll = (e) => {
    const container = e.target;
    const scrollLeft = container.scrollLeft;
    const itemWidth = 200 + 16; // image width + gap
    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    
    // If scrolled to the very end, show the last item
    if (scrollLeft >= maxScrollLeft - 1) {
      setCurrentGalleryIndex((d?.images?.length || 0) - 1);
    } else {
      const currentIndex = Math.round(scrollLeft / itemWidth);
      setCurrentGalleryIndex(Math.max(0, Math.min(currentIndex, (d?.images?.length || 0) - 1)));
    }
  };

  // Handle video scroll to update current index
  const handleVideoScroll = (e) => {
    const container = e.target;
    const scrollLeft = container.scrollLeft;
    const itemWidth = container.offsetWidth - 16; // container width - gap
    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    
    // If scrolled to the very end, show the last item
    if (scrollLeft >= maxScrollLeft - 1) {
      setCurrentVideoIndex((d?.videos?.length || 0) - 1);
    } else {
      const currentIndex = Math.round(scrollLeft / itemWidth);
      setCurrentVideoIndex(Math.max(0, Math.min(currentIndex, (d?.videos?.length || 0) - 1)));
    }
  };

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
      url = `${linkValue.replace(/^\$/, '')}`;
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

  const venmoLink = d.venmoUrl;
  const cashAppLink = d.cashAppTag
    ? `https://cash.app/$${d.cashAppTag.replace(/^\$+/, '')}`
    : d.cashAppUrl;
  const payPalLink = d.payPalUrl;

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
        padding: '0',
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
        width: '100%',
        boxSizing: 'border-box',
        backgroundColor: 'transparent',
        minHeight: '100vh'
      }}>
        {/* Spacer to account for sticky navbar */}
        <div className="navbar-spacer" style={{ height: '80px' }}></div>

      {/* Main content - responsive layout */}
      <div className="profile-container" style={{
        display: 'grid',
        gridTemplateColumns: '400px minmax(0, 1fr)',
        gap: '2rem',
        alignItems: 'start',
        margin: '0 1rem'
      }}>
        
        {/* Mobile-specific spacer for card overlay */}
        <div className="mobile-card-spacer" style={{ 
          height: '0px',
          display: 'none',
          gridColumn: '1 / -1'
        }}></div>
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
          {/* Introduction Section with Stacked Cards */}
          <div id="profile-banner" ref={bannerRef} style={{
            position: 'relative',
            marginBottom: '1rem',
            borderRadius: '30px',
            width: '100%',
            maxWidth: '100%'
          }}>
                          {/*Banner Background */}
              {d.profileBannerUrl && (
                <div className="banner-wrapper" style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: '30px',
                  overflow: 'hidden',
                  zIndex: 1
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '-10vh',
                    left: '-10%',
                    right: '-10%',
                    bottom: '20vh',
                    backgroundImage: `url(${d.profileBannerUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    transform: `translateY(${scrollY}px)`,
                    transition: 'transform 0.1s ease-out'
                  }} />
                </div>
              )}
              
              {/* Gradient overlay that extends beyond card boundaries */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `linear-gradient(to bottom, 
                  ${darkerSecondaryColor}00 0%,  
                  ${darkerSecondaryColor} 70%,
                  ${darkerSecondaryColor} 100%)`,
                zIndex: 1
              }} />
            
            {/* Main Content */}
            <div style={{
              position: 'relative',
              borderRadius: '30px',
              overflow: 'hidden',
              width: '100%',
              maxWidth: '100%',
              border: `2px solid ${tertiaryColor}`,
              boxShadow: `0 0 20px ${tertiaryColor}20`,
              zIndex: 2,
              backdropFilter: 'blur(6px)'
            }}>

              
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
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}>
                  {/* Action Icons */}
                  <div style={{
                    display: 'flex',
                    gap: '1.5rem',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    marginBottom: '0.5rem',
                    opacity: '1'
                  }}>
                    {getActiveActionIcons(d).map((icon) => (
                      <ActionIcon
                        key={icon.id}
                        icon={icon}
                        data={d}
                        onLinkClick={handleLinkClick}
                      />
                    ))}
                  </div>
                  
                  <h1 className="profile-name" style={{
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
                    <p className="profile-lastname" style={{
                      margin: '0 0 0.25rem 0',
                      color: '#c2c2c2',
                      fontSize: 'clamp(1.5rem, 4vw, 2rem)',
                      wordBreak: 'break-word',
                      fontWeight: '500',
                      lineHeight: '1'
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
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%'
              }}>
                <div style={{
                  display: 'flex',
                  gap: '1vw',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  marginLeft: `${100 / (getActiveSocialMediaLinks(d).length * 2) - 3}%`,
                  marginRight: `${100 / (getActiveSocialMediaLinks(d).length * 2) - 3}%`
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
                  lineHeight: '.8'
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

              {/* Thought Section - Only show if user has provided a thought */}
              {d.thought && d.thought.trim() && (
                <>
                  {/* Divider Line */}
                  <div style={{
                      width: '98%',
                      height: '1.5px',
                      margin: '0 2%',
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    }} />

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
                      padding: '.8rem 1rem',
                      position: 'relative',
                      backdropFilter: 'blur(5px)'
                    }}>
                      <div style={{
                        position: 'absolute',
                        top: '-2px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: '32px',
                        color: '#8e8e8e',
                        fontFamily: 'Arial',
                        fontWeight: 'bold'
                      }}>
                        “
                      </div>
                      <p style={{
                        margin: '1rem 0 0 0',
                        color: '#c2bebd',
                        fontSize: '14px',
                        lineHeight: '1.5',
                        fontWeight: '600',
                        wordBreak: 'break-word'
                      }}>
                        {d.thought}
                      </p>
                      <p style={{
                        margin: '1rem 0 0 0',
                        color: '#8e8e8e',
                        fontSize: '12px',
                        fontWeight: '800',
                        textAlign: 'center',
                        wordBreak: 'break-word'
                      }}>
                        {d.firstName.toUpperCase()} {d.lastName.toUpperCase()}
                      </p>
                    </div>
                  </div>
                </>
              )}

                              {/* Mobile Gallery Section */}
                <div className="mobile-gallery-section" style={{
                  width: '100%',
                  display: 'none'
                }}>
                  {!!d.images?.length && (
                    <div style={{
                      width: '100%',
                      boxSizing: 'border-box'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '1rem'
                      }}>
                        <h2 style={{
                          margin: '0',
                          color: '#a8a8a5',
                          fontSize: '18px',
                          fontWeight: '600'
                        }}>
                          Gallery
                        </h2>
                        
                        {/* Gallery Scroll Indicators */}
                        {d.images.length > 1 && (
                          <div style={{
                            display: 'flex',
                            gap: '0.5rem'
                          }}>
                            {d.images.map((_, index) => (
                              <div
                                key={index}
                                className="gallery-indicator"
                                style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  backgroundColor: index === currentGalleryIndex ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.3)',
                                  transition: 'background-color 0.3s ease',
                                  cursor: 'pointer'
                                }}
                                onClick={() => {
                                  const container = document.querySelector('.mobile-gallery-scroll');
                                  if (container) {
                                    container.scrollTo({
                                      left: index * (200 + 16), // 200px image width + 16px gap
                                      behavior: 'smooth'
                                    });
                                  }
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    
                    <div style={{ width: '100%', overflow: 'hidden', maxWidth: '100%' }}>
                      <div 
                        className="mobile-gallery-scroll"
                        style={{
                          display: 'flex',
                          overflowX: 'auto',
                          gap: '1rem',
                          paddingBottom: '0.5rem',
                          width: '100%',
                          boxSizing: 'border-box',
                          scrollSnapType: 'x mandatory',
                          scrollBehavior: 'smooth'
                        }}
                        onScroll={handleGalleryScroll}
                      >
                        {d.images.map((url, i) => (
                          <img 
                            key={i} 
                            src={url} 
                            alt=""
                            style={{
                              width: '200px',
                              height: '225px',
                              borderRadius: '20px',
                              objectFit: 'cover',
                              flexShrink: 0
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Mobile Videos Section */}
                {d.videos && d.videos.length > 0 && (
                  <div style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    marginTop: '1.5rem'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '1rem'
                    }}>
                      <h2 style={{
                        margin: '0',
                        color: '#a8a8a5',
                        fontSize: '18px',
                        fontWeight: '600'
                      }}>
                        Videos
                      </h2>
                      
                                              {/* Scroll Indicators */}
                        {d.videos.length > 1 && (
                          <div style={{
                            display: 'flex',
                            gap: '0.5rem'
                          }}>
                            {d.videos.map((_, index) => (
                              <div
                                key={index}
                                className="video-indicator"
                                style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  backgroundColor: index === currentVideoIndex ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.3)',
                                  transition: 'background-color 0.3s ease',
                                  cursor: 'pointer'
                                }}
                                onClick={() => {
                                  const container = document.querySelector('.mobile-video-scroll');
                                  if (container) {
                                    container.scrollTo({
                                      left: index * container.offsetWidth,
                                      behavior: 'smooth'
                                    });
                                  }
                                }}
                              />
                            ))}
                          </div>
                        )}
                    </div>
                    
                    <div style={{ 
                      width: '100%', 
                      overflow: 'hidden', 
                      maxWidth: '100%',
                      position: 'relative'
                    }}>
                      <div 
                        className="mobile-video-scroll"
                        style={{
                          display: 'flex',
                          overflowX: 'auto',
                          gap: '1rem',
                          paddingBottom: '0.5rem',
                          width: '100%',
                          boxSizing: 'border-box',
                          scrollSnapType: 'x mandatory',
                          scrollBehavior: 'smooth'
                        }}
                        onScroll={handleVideoScroll}
                      >
                        {d.videos.map((video, index) => (
                          <div
                            key={index}
                            style={{
                              position: 'relative',
                              width: '100%',
                              minWidth: '100%',
                              aspectRatio: '16/9',
                              borderRadius: '12px',
                              overflow: 'hidden',
                              cursor: 'pointer',
                              transition: 'transform 0.2s ease',
                              backgroundColor: 'rgba(64, 64, 64, 0.8)',
                              backdropFilter: 'blur(5px)',
                              flexShrink: 0,
                              scrollSnapAlign: 'start'
                            }}
                            onClick={() => {
                              // Open video in new tab
                              window.open(video.url, '_blank', 'noopener,noreferrer');
                              
                              // Track analytics if not the profile owner
                              if (!currentUser || currentUser.uid !== uid) {
                                (async () => {
                                  let visitorLocation = { location: 'Unknown' };
                                  try {
                                    visitorLocation = await getVisitorLocation();
                                  } catch (error) {
                                    console.error('Error getting visitor location:', error);
                                  }
                                  try {
                                    await trackLinkClick(uid, 'youtube_video', video.url, visitorLocation);
                                  } catch (error) {
                                    console.error('Error tracking video click:', error);
                                  }
                                })();
                              }
                            }}
                          >
                            {/* Video Thumbnail */}
                            <img
                              src={`https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`}
                              alt="Video thumbnail"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                borderRadius: '12px'
                              }}
                              onError={(e) => {
                                // Fallback to medium quality thumbnail if maxresdefault fails
                                e.target.src = `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`;
                              }}
                            />
                            
                            {/* Play Button Overlay */}
                            <div style={{
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%)',
                              width: '60px',
                              height: '60px',
                              backgroundColor: 'rgba(0, 0, 0, 0.7)',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              pointerEvents: 'none'
                            }}>
                              <div style={{
                                width: 0,
                                height: 0,
                                borderLeft: '20px solid white',
                                borderTop: '12px solid transparent',
                                borderBottom: '12px solid transparent',
                                marginLeft: '4px'
                              }} />
                            </div>
                            

                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Mobile Calendar Section */}
                {d.events && d.events.length > 0 && (
                  <div style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    marginTop: '1.5rem'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '1rem'
                    }}>
                      <h2 style={{
                        margin: '0',
                        color: '#a8a8a5',
                        fontSize: '18px',
                        fontWeight: '600'
                      }}>
                        Events
                      </h2>
                      <div style={{
                        display: 'flex',
                        gap: '0.5rem'
                      }}>
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            navigateCalendarMonths(-1);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#a8a8a5',
                            cursor: 'pointer',
                            fontSize: '16px',
                            padding: '4px 8px'
                          }}
                        >
                          ‹
                        </button>
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            navigateCalendarMonths(1);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#a8a8a5',
                            cursor: 'pointer',
                            fontSize: '16px',
                            padding: '4px 8px'
                          }}
                        >
                          ›
                        </button>
                      </div>
                    </div>
                    
                    <CalendarDisplay 
                      events={d.events}
                      onMonthChange={setCalendarMonth}
                      onNavigateMonths={navigateCalendarMonths}
                      calendarMonth={calendarMonth}
                      primaryColor={tertiaryColor}
                      secondaryColor={tertiaryColor}
                      tertiaryColor={tertiaryColor}
                    />
                  </div>
                )}
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
              
              <div style={{ width: '100%', overflow: 'scroll', maxWidth: '800px' }}>
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

          {/* Videos Section */}
          {d.videos && d.videos.length > 0 && (
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
              
              <div style={{ width: '100%', overflow: 'scroll', maxWidth: '800px' }}>
                <div 
                  className="video-scroll"
                  style={{
                    display: 'flex',
                    overflowX: 'auto',
                    gap: '1rem',
                    paddingBottom: '0.5rem',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                >
                  {d.videos.map((video, index) => (
                    <div
                      key={index}
                      style={{
                        position: 'relative',
                        width: d.videos.length === 2 ? 'calc(50% - 0.5rem)' : '330px',
                        aspectRatio: '16/9',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease',
                        backgroundColor: 'rgba(64, 64, 64, 0.8)',
                        backdropFilter: 'blur(5px)',
                        flexShrink: d.videos.length === 2 ? 1 : 0
                      }}
                      onClick={() => {
                        // Open video in new tab
                        window.open(video.url, '_blank', 'noopener,noreferrer');
                        
                        // Track analytics if not the profile owner
                        if (!currentUser || currentUser.uid !== uid) {
                          (async () => {
                            let visitorLocation = { location: 'Unknown' };
                            try {
                              visitorLocation = await getVisitorLocation();
                            } catch (error) {
                              console.error('Error getting visitor location:', error);
                            }
                            try {
                              await trackLinkClick(uid, 'youtube_video', video.url, visitorLocation);
                            } catch (error) {
                              console.error('Error tracking video click:', error);
                            }
                          })();
                        }
                      }}

                    >
                      {/* Video Thumbnail */}
                      <img
                        src={`https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`}
                        alt="Video thumbnail"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          borderRadius: '12px'
                        }}
                        onError={(e) => {
                          // Fallback to medium quality thumbnail if maxresdefault fails
                          e.target.src = `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`;
                        }}
                      />
                      
                      {/* Play Button Overlay */}
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '60px',
                        height: '60px',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none'
                      }}>
                        <div style={{
                          width: 0,
                          height: 0,
                          borderLeft: '20px solid white',
                          borderTop: '12px solid transparent',
                          borderBottom: '12px solid transparent',
                          marginLeft: '4px'
                        }} />
                      </div>
                      
                      {/* Video Title/Info Overlay */}
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.8))',
                        padding: '1rem',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        YouTube Video
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Calendar Section */}
          {d.events && d.events.length > 0 && (
            <div style={{
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem'
              }}>
                <h2 style={{
                  margin: '0',
                  color: '#a8a8a5',
                  fontSize: '18px',
                  fontWeight: '600'
                }}>
                  Events
                </h2>
                <div style={{
                  display: 'flex',
                  gap: '0.5rem'
                }}>
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigateCalendarMonths(-1);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#a8a8a5',
                      cursor: 'pointer',
                      fontSize: '16px',
                      padding: '4px 8px'
                    }}
                  >
                    ‹
                  </button>
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigateCalendarMonths(1);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#a8a8a5',
                      cursor: 'pointer',
                      fontSize: '16px',
                      padding: '4px 8px'
                    }}
                  >
                    ›
                  </button>
                </div>
              </div>
              
              <CalendarDisplay 
                events={d.events}
                onMonthChange={setCalendarMonth}
                onNavigateMonths={navigateCalendarMonths}
                calendarMonth={calendarMonth}
                primaryColor={tertiaryColor}
                secondaryColor={tertiaryColor}
                tertiaryColor={tertiaryColor}
              />
            </div>
          )}
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
          display: block !important;
          place-items: unset !important;
        }
        
        /* Ensure smooth transitions when background color changes */
        .profile-container {
          transition: background-color 0.3s ease;
        }
        
        /* Hide all scrollbars */
        ::-webkit-scrollbar {
          display: none;
        }
        
        * {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
        
        /* Gallery scrollbar styling - hidden */
        .gallery-scroll::-webkit-scrollbar {
          display: none;
        }
        
        .gallery-scroll {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
        
        /* Video scrollbar styling - hidden */
        .video-scroll::-webkit-scrollbar {
          display: none;
        }
        
        .video-scroll {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
        
        /* Mobile video scrollbar styling - hidden */
        .mobile-video-scroll::-webkit-scrollbar {
          display: none;
        }
        
        .mobile-video-scroll {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
        
        /* Mobile gallery scrollbar styling - hidden */
        .mobile-gallery-scroll::-webkit-scrollbar {
          display: none;
        }
        
        .mobile-gallery-scroll {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
        
        /* Calendar day styling */
        .calendar-day {
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          color: white;
          font-size: 14px;
          font-weight: 600;
          min-height: 32px;
          position: relative;
        }
        
        .calendar-day.empty {
          background: transparent;
        }
        
        /* Desktop styles - disable banner overflow */
        @media (min-width: 901px) {
          .banner-wrapper {
            overflow: hidden !important;
          }
          
          /* Desktop gradient with rounded borders */
          #profile-banner > div:nth-child(2) {
            border-radius: 30px !important;
          }
        }
        
                @media (max-width: 900px) {
          body {
            background: ${darkerSecondaryColor} !important;
          }
          
          .mobile-card-spacer {
            height: 30px !important;
            display: block !important;
          }
          
          .navbar-spacer {
            height: 0px !important;
          }
          
          .profile-container {
            grid-template-columns: 1fr !important;
            gap: 1rem !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow-x: hidden !important;
            max-width: 100vw !important;
          }
          
          /* Allow banner to overflow while keeping content constrained */
          #profile-banner {
            position: relative !important;
            width: 100% !important;
          }
          
          .banner-wrapper {
            overflow: visible !important;
            border-radius: 0 !important;
            position: absolute !important;
            left: -2vw !important;
            right: -2vw !important;
            width: calc(100% + 4vw) !important;
            height: 50% !important;
          }
          
          /* Limit banner background image height on mobile */
          .banner-wrapper > div {
            bottom: 0 !important;
            height: 100% !important;
          }
          
          /* Mobile gradient extension */
          #profile-banner > div:nth-child(2) {
            left: -5vw !important;
            right: -5vw !important;
            width: calc(100% + 10vw) !important;
          }
          
          #profile-banner > div:first-child {
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
          }
          
          /* Make sure all content fits within viewport */
          .profile-container > div {
            width: 100% !important;
            max-width: calc(100vw - 2rem) !important;
            box-sizing: border-box !important;
            margin: 0 auto !important;
          }
          
          /* Profile image sizing for mobile */
          .profile-image {
            width: clamp(150px, 30vw, 250px) !important;
            height: clamp(180px, 35vw, 300px) !important;
            min-width: 150px !important;
            min-height: 180px !important;
          }
          
          /* Name text sizing for mobile */
          .profile-name {
            font-size: clamp(2rem, 10vw, 3rem) !important;
            line-height: .8 !important;
          }
          
          .profile-lastname {
            font-size: clamp(1.8rem, 10vw, 2.8rem) !important;
          }
          
          /* Show mobile sections and hide desktop sections */
          .mobile-gallery-section {
            display: block !important;
          }
          
          /* Hide desktop gallery/videos/calendar sections on mobile */
          .profile-container > div:last-child {
            display: none !important;
          }
          
          /* Show only one month on mobile */
          .calendar-month-right {
            display: none !important;
          }
          
          /* Adjust calendar grid to single column on mobile */
          .calendar-display > div:first-child {
            grid-template-columns: 1fr !important;
            gap: 0 !important;
          }
          
          /* Hide vertical divider on mobile since there's only one month */
          .calendar-display > div:first-child > div[style*="position: absolute"][style*="left: 50%"] {
            display: none !important;
          }
          
          /* Center the calendar month on mobile with max width */
          .calendar-month-left {
            max-width: 550px !important;
            margin: 0 auto !important;
            width: 100% !important;
          }
        }
        
        /* Hide mobile sections on desktop */
        @media (min-width: 901px) {
          .mobile-gallery-section {
            display: none !important;
          }
          
          /* Hide calendar separation lines on desktop */
          .calendar-separation-line {
            display: none !important;
          }
          

        }
        
        /* Ensure no horizontal scrolling on mobile */
        body {
          overflow-x: hidden;
          max-width: 100vw;
          width: 100%;
        }
        
        /* Ensure the main container doesn't overflow */
        .profile-container {
          max-width: 100vw;
        }
        
        @media (max-width: 480px) {
          /* Further adjustments for very small screens */
          .profile-container {
            gap: 0.5rem !important;
          }
          
          /* Profile image on very small screens */
          .profile-image {
            width: clamp(130px, 28vw, 220px) !important;
            height: clamp(160px, 32vw, 280px) !important;
            min-width: 130px !important;
            min-height: 160px !important;
          }
          
          /* Name text sizing for very small screens */
          .profile-name {
            font-size: clamp(1.8rem, 5vw, 2.5rem) !important;
          }
          
          .profile-lastname {
            font-size: clamp(1.6rem, 4.5vw, 2.3rem) !important;
          }
        }
      `}</style>
    </div>
  );
}
