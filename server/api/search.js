import React, { useState, useEffect, useRef } from 'react';
import { 
  Search,
  SlidersHorizontal,
  Star,
  Clock,
  ThumbsUp,
  X,
  ChevronDown
} from 'lucide-react';
import { 
  Card,
  CardContent
} from "@/components/ui/card";

const SearchBar = ({ onSearch, currentUser }) => {
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [filters, setFilters] = useState({
    rating: '',
    priceRange: '',
    sortBy: 'rating',
    sortOrder: 'desc'
  });
  const [isLoading, setIsLoading] = useState(false);
  const searchTimeout = useRef(null);

  useEffect(() => {
    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, []);

  const handleSearch = async (searchQuery = query) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        query: searchQuery,
        ...filters
      });

      const response = await fetch('/api/search?${params}');
      const data = await response.json();

      onSearch(data.results);
      setSuggestions(data.suggestions);

      // Record search analytics
      await fetch('/api/search/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          userId: currentUser?.id,
          resultCount: data.results.length
        }),
      });
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQueryChange = (e) => {
    const newQuery = e.target.value;
    setQuery(newQuery);

    // Debounce search
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(() => {
      handleSearch(newQuery);
    }, 300);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      rating: '',
      priceRange: '',
      sortBy: 'rating',
      sortOrder: 'desc'
    });
    handleSearch();
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search beeferies, locations, or reviews..."
          value={query}
          onChange={handleQueryChange}
          className="w-full pl-10 pr-16 py-3 border border-border rounded-full focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        <Search className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="absolute right-3 top-2 p-1.5 rounded-full hover:bg-secondary transition-colors"
        >
          <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Suggestions Dropdown */}
        {suggestions.length > 0 && query && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-card rounded-lg shadow-lg border border-border py-2 z-50">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => {
                  setQuery(suggestion);
                  handleSearch(suggestion);
                  setSuggestions([]);
                }}
                className="w-full px-4 py-2 text-left hover:bg-slate-50 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="border border-border">
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-foreground">Filters</h3>
              <button
                onClick={clearFilters}
                className="text-sm text-primary hover:text-primary/90"
              >
                Clear all
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Rating Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Minimum Rating
                </label>
                <select
                  value={filters.rating}
                  onChange={(e) => handleFilterChange('rating', e.target.value)}
                  className="w-full p-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Any rating</option>
                  {[9, 8, 7, 6, 5].map(rating => (
                    <option key={rating} value={rating}>{rating.toFixed(1)}+</option>
                  ))}
                </select>
              </div>

              {/* Price Range Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Price Range
                </label>
                <select
                  value={filters.priceRange}
                  onChange={(e) => handleFilterChange('priceRange', e.target.value)}
                  className="w-full p-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Any price</option>
                  <option value="0-10">Under $10</option>
                  <option value="10-15">$10 - $15</option>
                  <option value="15-20">$15 - $20</option>
                  <option value="20-999">$20+</option>
                </select>
              </div>

              {/* Sort Options */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Sort By
                </label>
                <div className="flex space-x-2">
                  {[
                    { id: 'rating', icon: Star, label: 'Rating' },
                    { id: 'date', icon: Clock, label: 'Date' },
                    { id: 'likes', icon: ThumbsUp, label: 'Likes' }
                  ].map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      onClick={() => {
                        if (filters.sortBy === id) {
                          handleFilterChange('sortOrder', 
                            filters.sortOrder === 'desc' ? 'asc' : 'desc'
                          );
                        } else {
                          handleFilterChange('sortBy', id);
                          handleFilterChange('sortOrder', 'desc');
                        }
                      }}
                      className={'flex items-center space-x-1 px-3 py-1.5 rounded-full transition-colors ${
                        filters.sortBy === id
                          ? 'bg-primary text-white'
                          : 'bg-secondary text-muted-foreground hover:bg-border'
                      }'}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                      {filters.sortBy === id && (
                        <ChevronDown className={'h-4 w-4 transition-transform ${
                          filters.sortOrder === 'asc' ? 'rotate-180' : ''
                        }'} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SearchBar;