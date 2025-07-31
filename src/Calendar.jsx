import React, { useState, useEffect, useRef } from 'react';

// Reusable Month Calendar Component
const MonthCalendar = ({ 
  month, 
  events, 
  onDateClick, 
  eventsRef, 
  primaryColor = '#008080', 
  secondaryColor = '#008080', 
  tertiaryColor = '#008080' 
}) => {
  // Helper function to get day suffix (1st, 2nd, 3rd, etc.)
  const getDaySuffix = (day) => {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  // Helper function to get event duration
  const getEventDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return '';
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    return `${diffHours} hr${diffHours !== 1 ? 's' : ''}`;
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek };
  };

  const getEventsForDate = (date) => {
    if (!events) return [];
    return events.filter(event => {
      const eventDate = new Date(event.startTime);
      return eventDate.getDate() === date.getDate() &&
             eventDate.getMonth() === date.getMonth() &&
             eventDate.getFullYear() === date.getFullYear();
    });
  };

  const getEventColor = (eventIndex) => {
    const colors = [primaryColor, secondaryColor, tertiaryColor];
    return colors[eventIndex % colors.length];
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(month);
  const monthName = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(month.getFullYear(), month.getMonth(), day);
    const dayEvents = getEventsForDate(currentDate);
    const hasEvents = dayEvents.length > 0;

    days.push(
      <div 
        key={day} 
        className={`calendar-day ${hasEvents ? 'has-events' : ''}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (hasEvents && onDateClick) {
            onDateClick(currentDate);
          }
        }}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
          border: hasEvents ? `2px solid ${getEventColor(0)}` : 'none',
          backgroundColor: hasEvents ? `${getEventColor(0)}20` : 'transparent',
          cursor: hasEvents ? 'pointer' : 'default',
          transition: hasEvents ? 'transform 0.2s ease' : 'none'
        }}
        onMouseEnter={(e) => {
          if (hasEvents) {
            e.target.style.transform = 'scale(1.05)';
          }
        }}
        onMouseLeave={(e) => {
          if (hasEvents) {
            e.target.style.transform = 'scale(1)';
          }
        }}
      >
        <span className="day-number" style={{
          fontSize: '14px',
          fontWeight: '600',
          color: 'white'
        }}>
          {day}
        </span>
      </div>
    );
  }

  // Filter events for this month
  const monthEvents = events.filter(event => {
    const eventDate = new Date(event.startTime);
    const eventMonth = new Date(eventDate.getFullYear(), eventDate.getMonth(), 1);
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    return eventMonth.getTime() === monthStart.getTime();
  }).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  return (
    <div style={{ position: 'relative', maxWidth: '550px' }}>
      <h5 style={{
        margin: '0 0 0.5rem 0',
        color: '#a8a8a5',
        fontSize: '14px',
        fontWeight: '600',
        textAlign: 'left'
      }}>
        {monthName}
      </h5>
      
      {/* Calendar Container - Fixed height for 6-week month */}
      <div style={{
        height: '240px',
        marginBottom: '1rem',
        position: 'relative'
      }}>
        <div className="calendar-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '4px',
          height: '100%'
        }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} style={{
              textAlign: 'center',
              fontSize: '11px',
              color: '#ffffff',
              fontWeight: '600',
              padding: '2px 0',
              height: '20px'
            }}>
              {day}
            </div>
          ))}
          {days}
        </div>
      </div>
      
      {/* Month Events */}
      <div style={{
        height: '240px',
        overflowY: 'auto',
        padding: '0.5rem',
        backgroundColor: 'transparent',
        borderRadius: '8px'
      }}>
        {/* Mobile-only separation line */}
        <div 
          className="calendar-separation-line"
          style={{
            display: 'block',
            width: '100%',
            height: '1px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            marginBottom: '0.5rem'
          }} 
        />
        
        <div 
          ref={eventsRef}
          style={{
            maxHeight: '200px',
            overflowY: 'auto'
          }}
        >
          {monthEvents.map((event, index) => {
            const eventDate = new Date(event.startTime);
            const dayEvents = getEventsForDate(eventDate);
            const eventIndexInDay = dayEvents.findIndex(e => e.id === event.id);
            const eventColor = getEventColor(eventIndexInDay);
            const dayName = eventDate.toLocaleDateString('en-US', { weekday: 'long' });
            const dayWithSuffix = eventDate.getDate() + getDaySuffix(eventDate.getDate());
            const monthName = eventDate.toLocaleDateString('en-US', { month: 'short' });
            
            return (
              <div 
                key={event.id} 
                data-event-date={eventDate.toISOString().split('T')[0]}
                style={{
                  marginBottom: '1rem'
                }}
              >
                <div style={{
                  color: '#a8a8a5',
                  fontSize: '11px',
                  fontWeight: '500',
                  marginBottom: '0.5rem'
                }}>
                  {dayName}, {monthName} {dayWithSuffix}
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem'
                }}>
                  <div style={{
                    width: '3px',
                    height: '40px',
                    backgroundColor: eventColor,
                    borderRadius: '2px',
                    flexShrink: 0
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: '600',
                      marginBottom: '2px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {event.title}
                    </div>
                    <div style={{
                      color: '#a8a8a5',
                      fontSize: '10px'
                    }}>
                      {event.location || 'No location'}
                    </div>
                  </div>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: '2px'
                  }}>
                    <div style={{
                      color: '#a8a8a5',
                      fontSize: '10px'
                    }}>
                      {formatTime(event.startTime)}
                    </div>
                    <div style={{
                      color: '#a8a8a5',
                      fontSize: '10px'
                    }}>
                      {getEventDuration(event.startTime, event.endTime)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {monthEvents.length === 0 && (
            <div style={{
              color: '#888',
              fontSize: '11px',
              textAlign: 'center',
              padding: '1rem 0'
            }}>
              No events
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Calendar component for displaying events on profiles
export const CalendarDisplay = ({ events, onMonthChange, onNavigateMonths, calendarMonth, primaryColor = '#008080', secondaryColor = '#008080', tertiaryColor = '#008080' }) => {
  const [leftMonth, setLeftMonth] = useState(new Date());
  const [rightMonth, setRightMonth] = useState(new Date());
  const [isTransitioning, setIsTransitioning] = useState(false);
  const leftEventsRef = useRef(null);
  const rightEventsRef = useRef(null);

  // Function to scroll to events for a specific date
  const scrollToDateEvents = (clickedDate, monthType) => {
    const eventsRef = monthType === 'left' ? leftEventsRef : rightEventsRef;
    if (!eventsRef.current) return;

    const eventsContainer = eventsRef.current;
    const eventElements = eventsContainer.querySelectorAll('[data-event-date]');
    
    // Find the first event for the clicked date
    for (let element of eventElements) {
      const eventDate = element.getAttribute('data-event-date');
      if (eventDate === clickedDate.toISOString().split('T')[0]) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      }
    }
  };

  useEffect(() => {
    if (events && events.length > 0) {
      // Find the first event date and set it as the starting month
      const firstEventDate = new Date(Math.min(...events.map(e => new Date(e.startTime))));
      const startMonth = new Date(firstEventDate.getFullYear(), firstEventDate.getMonth(), 1);
      const nextMonth = new Date(startMonth.getFullYear(), startMonth.getMonth() + 1, 1);
      setLeftMonth(startMonth);
      setRightMonth(nextMonth);
    }
  }, [events]);

  // Sync with external navigation
  useEffect(() => {
    if (calendarMonth) {
      const currentMonth = new Date(calendarMonth);
      const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
      setLeftMonth(currentMonth);
      setRightMonth(nextMonth);
    }
  }, [calendarMonth]);

  const navigateMonths = (direction) => {
    if (onNavigateMonths) {
      setIsTransitioning(true);
      onNavigateMonths(direction);
      // Reset transition after animation
      setTimeout(() => setIsTransitioning(false), 300);
    } else {
      const newLeftMonth = new Date(leftMonth);
      const newRightMonth = new Date(rightMonth);
      newLeftMonth.setMonth(newLeftMonth.getMonth() + direction);
      newRightMonth.setMonth(newRightMonth.getMonth() + direction);
      setIsTransitioning(true);
      setLeftMonth(newLeftMonth);
      setRightMonth(newRightMonth);
      if (onMonthChange) onMonthChange(newLeftMonth);
      // Reset transition after animation
      setTimeout(() => setIsTransitioning(false), 300);
    }
  };

  return (
    <div 
      className="calendar-display" 
      onClick={(e) => e.stopPropagation()}
      style={{
        backgroundColor: 'transparent',
        width: '100%',
        marginBottom: '2rem'
      }}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '2rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Left Month */}
        <div 
          className="calendar-month-left"
          style={{ 
            position: 'relative',
            transform: isTransitioning ? 'translateX(-20px)' : 'translateX(0)',
            transition: 'transform 0.3s ease-in-out, opacity 0.3s ease-in-out',
            opacity: isTransitioning ? 0.7 : 1,
          }}
        >
          <MonthCalendar
            month={leftMonth}
            events={events}
            onDateClick={(clickedDate) => scrollToDateEvents(clickedDate, 'left')}
            eventsRef={leftEventsRef}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            tertiaryColor={tertiaryColor}
          />
        </div>

        {/* Vertical Divider */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '40px', // Start after the month names
          bottom: '280px', // End at the bottom of the calendar area
          width: '1.5px',
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          transform: 'translateX(-50%)'
        }} />

        {/* Right Month */}
        <div 
          className="calendar-month-right"
          style={{ 
            position: 'relative',
            transform: isTransitioning ? 'translateX(20px)' : 'translateX(0)',
            transition: 'transform 0.3s ease-in-out, opacity 0.3s ease-in-out',
            opacity: isTransitioning ? 0.7 : 1
          }}
        >
          <MonthCalendar
            month={rightMonth}
            events={events}
            onDateClick={(clickedDate) => scrollToDateEvents(clickedDate, 'right')}
            eventsRef={rightEventsRef}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            tertiaryColor={tertiaryColor}
          />
        </div>
      </div>
    </div>
  );
};

// Calendar component for adding events in forms
export const CalendarEditor = ({ events = [], onEventsChange }) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: '',
    startTime: '',
    endTime: '',
    location: ''
  });

  const [currentMonth, setCurrentMonth] = useState(new Date());

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek };
  };

  const getEventsForDate = (date) => {
    return events.filter(event => {
      const eventDate = new Date(event.startTime);
      return eventDate.getDate() === date.getDate() &&
             eventDate.getMonth() === date.getMonth() &&
             eventDate.getFullYear() === date.getFullYear();
    });
  };

  const handleDateClick = (day) => {
    const clickedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setSelectedDate(clickedDate);
    
    // Pre-fill the form with the selected date
    const dateString = clickedDate.toISOString().split('T')[0];
    setEventForm({
      title: '',
      startTime: `${dateString}T12:00`,
      endTime: `${dateString}T13:00`,
      location: ''
    });
    setShowEventForm(true);
  };

  const handleAddEvent = () => {
    if (!eventForm.title.trim() || !eventForm.startTime || !eventForm.endTime) {
      return;
    }

    const newEvent = {
      id: Date.now().toString(),
      ...eventForm,
      startTime: new Date(eventForm.startTime).toISOString(),
      endTime: new Date(eventForm.endTime).toISOString()
    };

    onEventsChange([...events, newEvent]);
    setShowEventForm(false);
    setEventForm({ title: '', startTime: '', endTime: '', location: '' });
  };

  const handleDeleteEvent = (eventId) => {
    onEventsChange(events.filter(event => event.id !== eventId));
  };

  const navigateMonth = (direction) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);
    setCurrentMonth(newMonth);
  };

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const dayEvents = getEventsForDate(currentDate);
    const hasEvents = dayEvents.length > 0;
    const isPast = currentDate < new Date(new Date().setHours(0, 0, 0, 0));

          days.push(
        <div 
          key={day} 
          className={`calendar-day ${hasEvents ? 'has-events' : ''} ${isPast ? 'past' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isPast) handleDateClick(day);
          }}
          style={{
            position: 'relative',
            minHeight: '40px',
            cursor: isPast ? 'default' : 'pointer',
            opacity: isPast ? 0.5 : 1
          }}
        >
        <span className="day-number">{day}</span>
        {hasEvents && (
          <div className="event-indicators">
            {dayEvents.slice(0, 2).map((event, index) => (
              <div 
                key={index}
                className="event-dot"
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#ea8151',
                  margin: '1px',
                  display: 'inline-block'
                }}
              />
            ))}
            {dayEvents.length > 2 && (
              <span className="more-events" style={{ fontSize: '10px', color: '#ea8151' }}>
                +{dayEvents.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="calendar-editor">
      <div 
        className="calendar-container" 
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'rgba(64, 64, 64, 0.8)',
          borderRadius: '12px',
          padding: '1rem',
          backdropFilter: 'blur(5px)',
          marginBottom: '1rem'
        }}
      >
        <div className="calendar-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigateMonth(-1);
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
          <h4 style={{ 
            margin: '0', 
            color: 'white', 
            fontSize: '16px',
            fontWeight: '600'
          }}>
            {monthName}
          </h4>
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigateMonth(1);
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

        <div className="calendar-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '4px'
        }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} style={{
              textAlign: 'center',
              fontSize: '11px',
              color: '#a8a8a5',
              fontWeight: '600',
              padding: '2px 0'
            }}>
              {day}
            </div>
          ))}
          {days}
        </div>
      </div>

      {/* Event Form Modal */}
      {showEventForm && (
        <div className="event-form-modal" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="event-form" style={{
            backgroundColor: '#2a2a2a',
            borderRadius: '12px',
            padding: '2rem',
            width: '90%',
            maxWidth: '400px'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: 'white' }}>Add Event</h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#a8a8a5', marginBottom: '0.5rem' }}>
                Event Title *
              </label>
              <input
                type="text"
                value={eventForm.title}
                onChange={(e) => setEventForm({...eventForm, title: e.target.value})}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  border: '1px solid #444',
                  backgroundColor: '#1a1a1a',
                  color: 'white'
                }}
                placeholder="Event title"
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#a8a8a5', marginBottom: '0.5rem' }}>
                Start Time *
              </label>
              <input
                type="datetime-local"
                value={eventForm.startTime}
                onChange={(e) => setEventForm({...eventForm, startTime: e.target.value})}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  border: '1px solid #444',
                  backgroundColor: '#1a1a1a',
                  color: 'white'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#a8a8a5', marginBottom: '0.5rem' }}>
                End Time *
              </label>
              <input
                type="datetime-local"
                value={eventForm.endTime}
                onChange={(e) => setEventForm({...eventForm, endTime: e.target.value})}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  border: '1px solid #444',
                  backgroundColor: '#1a1a1a',
                  color: 'white'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#a8a8a5', marginBottom: '0.5rem' }}>
                Location
              </label>
              <input
                type="text"
                value={eventForm.location}
                onChange={(e) => setEventForm({...eventForm, location: e.target.value})}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  border: '1px solid #444',
                  backgroundColor: '#1a1a1a',
                  color: 'white'
                }}
                placeholder="Event location (optional)"
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowEventForm(false);
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '4px',
                  border: '1px solid #444',
                  backgroundColor: 'transparent',
                  color: '#a8a8a5',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAddEvent();
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: '#ea8151',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Add Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Events List */}
      {events.length > 0 && (
        <div 
          className="events-list" 
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: 'rgba(64, 64, 64, 0.8)',
            borderRadius: '12px',
            padding: '1rem',
            backdropFilter: 'blur(5px)'
          }}
        >
          <h4 style={{ margin: '0 0 1rem 0', color: 'white', fontSize: '14px' }}>
            Your Events
          </h4>
          {events
            .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
            .map(event => (
              <div key={event.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem',
                marginBottom: '0.5rem',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '4px'
              }}>
                <div>
                  <div style={{ color: 'white', fontWeight: '600', fontSize: '14px' }}>
                    {event.title}
                  </div>
                  <div style={{ color: '#a8a8a5', fontSize: '12px' }}>
                    {new Date(event.startTime).toLocaleDateString()} at {new Date(event.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    {event.location && ` • ${event.location}`}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteEvent(event.id);
                  }}
                  style={{
                    background: '#ff4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0.25rem 0.5rem',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}; 