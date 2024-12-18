import React from 'react';

const Navbar = () => {
    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <a href="/">Home</a>
            </div>
            <ul className="navbar-nav">
                <li className="nav-item">
                    <a href="/dashboard" className="nav-link">dashboard</a>
                </li>
            </ul>
        </nav>
    );
};

export default Navbar;
