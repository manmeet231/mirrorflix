import React, { useRef, useState } from 'react';
import './Navbar.css';

const Navbar = ({ searchQuery, onSearchChange }) => {
  const searchInput = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const [activeNav, setActiveNav] = useState('Home');

  const clearSearch = () => {
    onSearchChange('');
    searchInput.current?.focus();
  };

  const handleScroll = () => {
    setScrolled(window.scrollY > 50);
  };

  const handleNavClick = (navItem) => {
    setActiveNav(navItem);
    if (navItem === 'Home') onSearchChange('');
  };

  React.useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { id: 'Home', label: 'Home' },
    { id: 'TV Shows', label: 'TV Shows' },
    { id: 'Movies', label: 'Movies' },
    { id: 'My List', label: 'My List' },
  ];

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="navbar-left">
        <div className="navbar-logo">MIRRORFLIX</div>
        <div className="navbar-center">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-pill ${activeNav === item.id ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="navbar-right">
        <div className="anime-search-box" role="search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <input
            ref={searchInput}
            type="search"
            aria-label="Search movies, TV series, and anime"
            placeholder="Search titles"
            maxLength={100}
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                clearSearch();
              }
            }}
          />
          {searchQuery && (
            <button className="anime-search-clear" type="button" aria-label="Clear search" onClick={clearSearch}>
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
          />
        </svg>
      </div>
    </nav>
  );
};

export default Navbar;
