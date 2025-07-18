import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  increment, 
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  startAfter
} from 'firebase/firestore';

// Track profile view
export const trackProfileView = async (profileId, visitorInfo = {}) => {
  try {
    const eventData = {
      type: 'profile_view',
      profileId,
      timestamp: serverTimestamp(),
      visitorId: visitorInfo.visitorId || generateVisitorId(),
      userAgent: navigator.userAgent,
      referrer: document.referrer || 'direct',
      ...visitorInfo
    };

    // Add to events collection
    await addDoc(collection(db, 'analytics', profileId, 'events'), eventData);

    // Update summary stats
    await updateAnalyticsSummary(profileId, 'profile_view');

    console.log('Profile view tracked successfully');
  } catch (error) {
    console.error('Error tracking profile view:', error);
  }
};

// Track link click
export const trackLinkClick = async (profileId, linkType, linkUrl, visitorInfo = {}) => {
  try {
    console.log('Tracking link click:', { profileId, linkType, linkUrl });
    
    const eventData = {
      type: 'link_click',
      profileId,
      linkType, // 'spotify', 'youtube', 'paypal', etc.
      linkUrl,
      timestamp: serverTimestamp(),
      visitorId: visitorInfo.visitorId || generateVisitorId(),
      userAgent: navigator.userAgent,
      referrer: document.referrer || 'direct',
      ...visitorInfo
    };

    // Add to events collection
    await addDoc(collection(db, 'analytics', profileId, 'events'), eventData);

    // Update summary stats
    await updateAnalyticsSummary(profileId, 'link_click', linkType);

    console.log('Link click tracked successfully:', linkType);
  } catch (error) {
    console.error('Error tracking link click:', error);
  }
};

// Update analytics summary
const updateAnalyticsSummary = async (profileId, eventType, linkType = null) => {
  try {
    console.log('Updating analytics summary:', { profileId, eventType, linkType });
    
    const summaryRef = doc(db, 'analytics', profileId, 'summary', 'current');
    const summaryDoc = await getDoc(summaryRef);

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format

    if (!summaryDoc.exists()) {
      console.log('Creating initial summary document');
      // Create initial summary document
      const initialData = {
        totalProfileViews: eventType === 'profile_view' ? 1 : 0,
        totalLinkClicks: eventType === 'link_click' ? 1 : 0,
        monthlyStats: {
          [currentMonth]: {
            views: eventType === 'profile_view' ? 1 : 0,
            clicks: eventType === 'link_click' ? 1 : 0
          }
        },
        dailyStats: {
          [today]: {
            views: eventType === 'profile_view' ? 1 : 0,
            clicks: eventType === 'link_click' ? 1 : 0
          }
        },
        linkStats: linkType ? { [linkType]: 1 } : {},
        lastUpdated: serverTimestamp()
      };
      
      console.log('Initial data:', initialData);
      await setDoc(summaryRef, initialData);
    } else {
      console.log('Updating existing summary document');
      // Update existing summary
      const updates = {
        lastUpdated: serverTimestamp()
      };

      if (eventType === 'profile_view') {
        updates.totalProfileViews = increment(1);
        updates[`monthlyStats.${currentMonth}.views`] = increment(1);
        updates[`dailyStats.${today}.views`] = increment(1);
      } else if (eventType === 'link_click') {
        updates.totalLinkClicks = increment(1);
        updates[`monthlyStats.${currentMonth}.clicks`] = increment(1);
        updates[`dailyStats.${today}.clicks`] = increment(1);
        
        if (linkType) {
          updates[`linkStats.${linkType}`] = increment(1);
        }
      }

      console.log('Updates to apply:', updates);
      await updateDoc(summaryRef, updates);
    }
    
    console.log('Analytics summary updated successfully');
  } catch (error) {
    console.error('Error updating analytics summary:', error);
  }
};

// Get analytics data for dashboard
export const getAnalyticsData = async (profileId) => {
  try {
    console.log('Getting analytics data for profile:', profileId);
    
    // Get summary data
    const summaryRef = doc(db, 'analytics', profileId, 'summary', 'current');
    const summaryDoc = await getDoc(summaryRef);
    
    let summaryData = {
      totalProfileViews: 0,
      totalLinkClicks: 0,
      monthlyStats: {},
      dailyStats: {},
      linkStats: {}
    };

    if (summaryDoc.exists()) {
      summaryData = summaryDoc.data();
      console.log('Summary data found:', summaryData);
    } else {
      console.log('No summary document found');
    }

    // Get recent events (last 50)
    const eventsQuery = query(
      collection(db, 'analytics', profileId, 'events'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    
    const eventsSnapshot = await getDocs(eventsQuery);
    const recentEvents = eventsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.() || new Date()
    }));

    // Process monthly stats for chart
    const monthlyStatsArray = Object.entries(summaryData.monthlyStats || {})
      .map(([month, stats]) => ({
        month: formatMonthLabel(month),
        views: stats.views || 0,
        clicks: stats.clicks || 0
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6); // Last 6 months

    // Process link stats for chart
    const totalClicks = summaryData.totalLinkClicks || 0;
    const linkStatsArray = Object.entries(summaryData.linkStats || {})
      .map(([link, clicks]) => ({
        link: capitalizeFirst(link),
        clicks,
        percentage: totalClicks > 0 ? Math.round((clicks / totalClicks) * 100) : 0
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 5); // Top 5 links

    return {
      profileViews: summaryData.totalProfileViews || 0,
      linkClicks: summaryData.totalLinkClicks || 0,
      recentActivity: recentEvents,
      monthlyStats: monthlyStatsArray,
      topLinks: linkStatsArray,
      clickRate: summaryData.totalProfileViews > 0 
        ? ((summaryData.totalLinkClicks / summaryData.totalProfileViews) * 100).toFixed(1)
        : 0
    };
  } catch (error) {
    console.error('Error getting analytics data:', error);
    return {
      profileViews: 0,
      linkClicks: 0,
      recentActivity: [],
      monthlyStats: [],
      topLinks: [],
      clickRate: 0
    };
  }
};

// Helper functions
const generateVisitorId = () => {
  // Generate a simple visitor ID (you might want to use a more sophisticated approach)
  let visitorId = localStorage.getItem('tipt_visitor_id');
  if (!visitorId) {
    visitorId = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('tipt_visitor_id', visitorId);
  }
  return visitorId;
};

const formatMonthLabel = (monthString) => {
  const [year, month] = monthString.split('-');
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('en-US', { month: 'short' });
};

const capitalizeFirst = (str) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

// Get visitor location (optional - requires external service)
export const getVisitorLocation = async () => {
  try {
    // Try to get location, but don't let it block tracking
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
    
    const response = await fetch('https://ipapi.co/json/', {
      signal: controller.signal,
      mode: 'cors'
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      return {
        city: data.city,
        region: data.region,
        country: data.country_name,
        location: `${data.city}, ${data.region}`
      };
    }
  } catch (error) {
    // Don't log CORS errors as they're expected in development
    if (!error.message.includes('CORS') && !error.message.includes('Failed to fetch')) {
      console.error('Error getting visitor location:', error);
    }
  }
  return { location: 'Unknown' };
};
