import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from './firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { getAnalyticsData } from './analytics';
import './Dashboard.css';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [analytics, setAnalytics] = useState({
    profileViews: 0,
    linkClicks: 0,
    recentActivity: [],
    monthlyStats: [],
    topLinks: []
  });
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        nav('/signup');
        return;
      }
      
      setUser(currentUser);
      await loadUserData(currentUser.uid);
    });

    return unsubAuth;
  }, [nav]);

  const loadUserData = async (uid) => {
    try {
      // Load user profile
      const profileDoc = await getDoc(doc(db, 'recipients', uid));
      if (profileDoc.exists()) {
        setProfile(profileDoc.data());
      }

      // Load real analytics data
      const analyticsData = await getAnalyticsData(uid);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading your analytics...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Analytics Dashboard</h1>
        <p>Welcome back, {profile?.firstName || 'User'}!</p>
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">👁️</div>
          <div className="metric-content">
            <h3>Profile Views</h3>
            <p className="metric-value">{analytics.profileViews.toLocaleString()}</p>
          </div>
        </div>
        
        <div className="metric-card">
          <div className="metric-icon">🔗</div>
          <div className="metric-content">
            <h3>Link Clicks</h3>
            <p className="metric-value">{analytics.linkClicks.toLocaleString()}</p>
          </div>
        </div>
        
        <div className="metric-card">
          <div className="metric-icon">📊</div>
          <div className="metric-content">
            <h3>Click Rate</h3>
            <p className="metric-value">{analytics.clickRate}%</p>
          </div>
        </div>
        
        <div className="metric-card">
          <div className="metric-icon">📈</div>
          <div className="metric-content">
            <h3>This Month</h3>
            <p className="metric-value">{analytics.monthlyStats[analytics.monthlyStats.length - 1]?.views || 0}</p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-section">
        <div className="chart-card">
          <h3>Monthly Views</h3>
          <div className="bar-chart">
            {analytics.monthlyStats.length > 0 ? analytics.monthlyStats.map((stat, index) => (
              <div key={stat.month} className="bar-item">
                <div 
                  className="bar" 
                  style={{ 
                    height: `${(stat.views / Math.max(...analytics.monthlyStats.map(s => s.views))) * 100}%` 
                  }}
                ></div>
                <span className="bar-label">{stat.month}</span>
                <span className="bar-value">{stat.views}</span>
              </div>
            )) : (
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999', fontStyle: 'italic'}}>
                No data yet
              </div>
            )}
          </div>
        </div>

        <div className="chart-card">
          <h3>Top Links</h3>
          <div className="genre-chart">
            {analytics.topLinks.length > 0 ? analytics.topLinks.map((link, index) => (
              <div key={link.link} className="genre-item">
                <div className="genre-info">
                  <span className="genre-name">{link.link}</span>
                  <span className="genre-percentage">{link.clicks} clicks</span>
                </div>
                <div className="genre-bar">
                  <div 
                    className="genre-fill" 
                    style={{ width: `${link.percentage}%` }}
                  ></div>
                </div>
              </div>
            )) : (
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999', fontStyle: 'italic'}}>
                No link clicks yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="recent-tips-section">
        <h3>Recent Activity</h3>
        <div className="tips-table">
          <div className="tips-header">
            <span>Type</span>
            <span>Visitor</span>
            <span>Date</span>
            <span>Details</span>
          </div>
          {analytics.recentActivity.length > 0 ? analytics.recentActivity.map((activity) => (
            <div key={activity.id} className="tip-row">
              <span className={`tip-amount ${activity.type === 'profile_view' ? 'view-type' : 'click-type'}`}>
                {activity.type === 'profile_view' ? '👁️ View' : '🔗 Click'}
              </span>
              <span className="tip-from">{activity.visitorId?.includes('visitor_') ? 'Anonymous' : activity.visitorId || 'Anonymous'}</span>
              <span className="tip-date">{formatDate(activity.timestamp)}</span>
              <span className="tip-message">
                {activity.type === 'profile_view' 
                  ? (activity.location || 'Unknown location')
                  : `${activity.linkType || 'Unknown'} link`
                }
              </span>
            </div>
          )) : (
            <div className="tip-row">
              <span className="tip-message" style={{gridColumn: '1 / -1', textAlign: 'center', fontStyle: 'italic', color: '#999'}}>
                No activity yet. Share your profile to start tracking!
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="action-buttons">
          <button 
            className="action-btn primary"
            onClick={() => nav(`/profile/${user.uid}`)}
          >
            View Profile
          </button>
          <button 
            className="action-btn secondary"
            onClick={() => nav(`/profile/${user.uid}/edit`)}
          >
            Edit Profile
          </button>
          <button className="action-btn secondary">
            Export Data
          </button>
          <button className="action-btn secondary">
            Share Profile
          </button>
        </div>
      </div>
    </div>
  );
}
