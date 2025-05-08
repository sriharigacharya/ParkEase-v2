import React from 'react';
import { Car } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-primary-800 text-white py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center mb-4">
              <Car className="h-6 w-6 mr-2" />
              <span className="text-lg font-bold">ParkEase</span>
            </div>
            <p className="text-sm text-primary-200">
              Making parking simple and efficient. Find, book, and manage parking spots with ease.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/" className="hover:text-primary-300 transition-colors">Home</a>
              </li>
              <li>
                <a href="/login" className="hover:text-primary-300 transition-colors">Login</a>
              </li>
              <li>
                <a href="/register" className="hover:text-primary-300 transition-colors">Register</a>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact</h3>
            <ul className="space-y-2 text-sm">
              <li>Email: 2023ci_snettikantiajay_b@nie.ac.in</li>
              <li>Address: NIE North,Mysuru</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-primary-700 text-sm text-center text-primary-300">
          &copy; {new Date().getFullYear()} ParkEase. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;