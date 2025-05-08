import React, { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';

type FilterProps = {
  onFilterChange: (filters: FilterValues) => void;
};

export type FilterValues = {
  distance: number;
  minAvailableSlots: number;
  minRating: number;
};

const LocationFilters: React.FC<FilterProps> = ({ onFilterChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<FilterValues>({
    distance: 5,
    minAvailableSlots: 0,
    minRating: 0,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: Number(value),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange(filters);
    setIsOpen(false);
  };

  const resetFilters = () => {
    const defaultFilters = {
      distance: 5,
      minAvailableSlots: 0,
      minRating: 0,
    };
    setFilters(defaultFilters);
    onFilterChange(defaultFilters);
  };

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-3">
        {/* <h2 className="text-xl font-semibold text-secondary-800">Find Parking</h2> */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center text-primary-600 hover:text-primary-800 transition-colors"
        >
          {isOpen ? <X className="w-5 h-5 mr-1" /> : <Filter className="w-5 h-5 mr-1" />}
          {isOpen ? 'Close' : 'Filters'}
        </button>
      </div>

      {isOpen && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow-md mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="distance" className="block text-sm font-medium text-secondary-700 mb-1">
                Maximum Distance (km): {filters.distance}
              </label>
              <input
                type="range"
                id="distance"
                name="distance"
                min="1"
                max="50"
                step="1"
                value={filters.distance}
                onChange={handleChange}
                className="w-full h-2 bg-primary-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
              />
            </div>

            <div>
              <label htmlFor="minAvailableSlots" className="block text-sm font-medium text-secondary-700 mb-1">
                Minimum Available Slots: {filters.minAvailableSlots}
              </label>
              <input
                type="range"
                id="minAvailableSlots"
                name="minAvailableSlots"
                min="0"
                max="10"
                step="1"
                value={filters.minAvailableSlots}
                onChange={handleChange}
                className="w-full h-2 bg-primary-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
              />
            </div>

            <div>
              <label htmlFor="minRating" className="block text-sm font-medium text-secondary-700 mb-1">
                Minimum Rating: {filters.minRating}
              </label>
              <input
                type="range"
                id="minRating"
                name="minRating"
                min="0"
                max="5"
                step="0.5"
                value={filters.minRating}
                onChange={handleChange}
                className="w-full h-2 bg-primary-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end space-x-2">
            <button
              type="button"
              onClick={resetFilters}
              className="px-3 py-1 text-sm bg-secondary-200 text-secondary-700 rounded hover:bg-secondary-300 transition-colors"
            >
              Reset
            </button>
            <button
              type="submit"
              className="px-3 py-1 text-sm bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </form>
      )}

      {/* <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-secondary-400" />
        </div>
        <input
          type="text"
          placeholder="Search for parking locations..."
          className="pl-10 pr-4 py-2 w-full border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
      </div> */}
    </div>
  );
};

export default LocationFilters;