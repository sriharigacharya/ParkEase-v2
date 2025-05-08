// src/pages/admin/AdminLocations.tsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { MapPin, Plus, Upload, Edit3, Trash2, X, Save, AlertCircle, CheckCircle, Building } from 'lucide-react'; // Added more icons

type Location = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  totalSlots: number;
  availableSlots: number; // Assuming this is part of the fetched data
  coverImageUrl: string | null; // Can be null
  averageRating?: number; // Optional, as in your original type
  feedbackCount?: number; // Optional
};

const initialFormData = {
  name: '',
  latitude: '',
  longitude: '',
  totalSlots: '',
  coverImage: null as File | null,
};

const AdminLocations: React.FC = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormData, setAddFormData] = useState(initialFormData);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [editFormData, setEditFormData] = useState({
    id: 0,
    name: '',
    latitude: '',
    longitude: '',
    totalSlots: '',
    coverImage: null as File | null,
    currentCoverImageUrl: '' as string | null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);


  const clearMessages = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const fetchLocations = async () => {
    setLoading(true);
    clearMessages();
    try {
      const response = await axios.get('/api/admin/locations'); // Your existing endpoint
      setLocations(response.data);
    } catch (err) {
      console.error('Error fetching locations:', err);
      setError('Failed to load parking locations. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleAddInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    if (type === 'file') {
      const files = e.target.files;
      setAddFormData(prev => ({ ...prev, coverImage: files ? files[0] : null }));
    } else {
      setAddFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setActionInProgress(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('name', addFormData.name);
      formDataToSend.append('latitude', addFormData.latitude);
      formDataToSend.append('longitude', addFormData.longitude);
      formDataToSend.append('totalSlots', addFormData.totalSlots);
      if (addFormData.coverImage) {
        formDataToSend.append('coverImage', addFormData.coverImage);
      }

      await axios.post('/api/admin/parking-location', formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccessMessage('Parking location added successfully!');
      setAddFormData(initialFormData);
      setShowAddForm(false);
      if(fileInputRef.current) fileInputRef.current.value = ""; // Clear file input
      fetchLocations();
    } catch (err: any) {
      console.error('Error adding location:', err);
      setError(err.response?.data?.message || 'Failed to add parking location.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleEditClick = (location: Location) => {
    clearMessages();
    setEditingLocation(location);
    setEditFormData({
      id: location.id,
      name: location.name,
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(),
      totalSlots: location.totalSlots.toString(),
      coverImage: null, // Reset file input for edit
      currentCoverImageUrl: location.coverImageUrl,
    });
    setShowEditModal(true);
  };
  
  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    if (type === 'file') {
      const files = e.target.files;
      setEditFormData(prev => ({ ...prev, coverImage: files ? files[0] : null }));
    } else {
      setEditFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLocation) return;
    clearMessages();
    setActionInProgress(true);

    const formDataToSend = new FormData();
    formDataToSend.append('name', editFormData.name);
    formDataToSend.append('latitude', editFormData.latitude);
    formDataToSend.append('longitude', editFormData.longitude);
    formDataToSend.append('totalSlots', editFormData.totalSlots);
    if (editFormData.coverImage) { // Only append if a new image is selected
      formDataToSend.append('coverImage', editFormData.coverImage);
    }
    // You might want to send editFormData.currentCoverImageUrl if your backend needs it
    // to decide about deleting the old image, especially if no new one is uploaded.

    try {
      await axios.put(`/api/admin/parking-location/${editingLocation.id}`, formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccessMessage('Parking location updated successfully!');
      setShowEditModal(false);
      setEditingLocation(null);
      if(editFileInputRef.current) editFileInputRef.current.value = ""; // Clear file input
      fetchLocations();
    } catch (err: any) {
      console.error('Error updating location:', err);
      setError(err.response?.data?.message || 'Failed to update parking location.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDeleteClick = async (locationId: number) => {
    clearMessages();
    if (window.confirm('Are you sure you want to delete this parking location? This may affect existing bookings or employee assignments.')) {
      setActionInProgress(true);
      try {
        await axios.delete(`/api/admin/parking-location/${locationId}`);
        setSuccessMessage('Parking location deleted successfully!');
        fetchLocations();
      } catch (err: any) {
        console.error('Error deleting location:', err);
        setError(err.response?.data?.message || 'Failed to delete parking location.');
      } finally {
        setActionInProgress(false);
      }
    }
  };


  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-secondary-900">Parking Locations</h1>
        <button
          onClick={() => { setShowAddForm(!showAddForm); clearMessages(); if (showAddForm) setAddFormData(initialFormData);}}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors disabled:opacity-50"
          disabled={actionInProgress}
        >
          {showAddForm ? (
            <><X className="h-5 w-5 mr-2" />Cancel Add</>
          ) : (
            <><Plus className="h-5 w-5 mr-2" />Add Location</>
          )}
        </button>
      </div>

      {/* Feedback Messages */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md flex items-center" role="alert">
          <AlertCircle className="h-5 w-5 mr-3" /> <p>{error}</p>
        </div>
      )}
      {successMessage && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6 rounded-md flex items-center" role="alert">
          <CheckCircle className="h-5 w-5 mr-3" /> <p>{successMessage}</p>
        </div>
      )}

      {/* Add Location Form */}
      {showAddForm && (
        <form onSubmit={handleAddSubmit} className="bg-white p-6 rounded-lg shadow-md mb-8 transition-all duration-300 ease-in-out">
          <h2 className="text-xl font-semibold text-secondary-800 mb-4">Add New Parking Location</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">Location Name</label>
              <input type="text" name="name" value={addFormData.name} onChange={handleAddInputChange} required 
                     className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">Total Slots</label>
              <input type="number" name="totalSlots" value={addFormData.totalSlots} onChange={handleAddInputChange} required min="1"
                     className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">Latitude</label>
              <input type="number" step="any" name="latitude" value={addFormData.latitude} onChange={handleAddInputChange} required
                     className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">Longitude</label>
              <input type="number" step="any" name="longitude" value={addFormData.longitude} onChange={handleAddInputChange} required
                     className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"/>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-secondary-700 mb-1">Cover Image</label>
              <div className="flex items-center">
                <label className="flex items-center px-4 py-2 bg-secondary-100 text-secondary-700 rounded-md cursor-pointer hover:bg-secondary-200 transition-colors">
                  <Upload className="h-5 w-5 mr-2" /> Choose File
                  <input type="file" name="coverImage" ref={fileInputRef} onChange={handleAddInputChange} accept="image/*" className="hidden"/>
                </label>
                {addFormData.coverImage && (<span className="ml-3 text-sm text-secondary-600">{addFormData.coverImage.name}</span>)}
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
             <button type="button" onClick={() => { setShowAddForm(false); setAddFormData(initialFormData); clearMessages(); if(fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="px-4 py-2 bg-secondary-200 text-secondary-700 rounded-md hover:bg-secondary-300 transition-colors disabled:opacity-50"
                    disabled={actionInProgress}>
              Cancel
            </button>
            <button type="submit" disabled={actionInProgress}
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors flex items-center disabled:opacity-50">
              <Plus className="h-5 w-5 mr-2" /> Add Location
            </button>
          </div>
        </form>
      )}

      {/* Edit Location Modal */}
      {showEditModal && editingLocation && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
            <form onSubmit={handleEditSubmit} className="bg-white p-6 sm:p-8 rounded-lg shadow-xl w-full max-w-lg mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl sm:text-2xl font-semibold text-secondary-800">Edit: {editingLocation.name}</h2>
                    <button type="button" onClick={() => { setShowEditModal(false); setEditingLocation(null); clearMessages(); if(editFileInputRef.current) editFileInputRef.current.value = ""; }} 
                            className="text-secondary-500 hover:text-secondary-700" disabled={actionInProgress}>
                        <X size={24} />
                    </button>
                </div>
                
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-1">Location Name</label>
                        <input type="text" name="name" value={editFormData.name} onChange={handleEditInputChange} required 
                            className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-1">Total Slots</label>
                        <input type="number" name="totalSlots" value={editFormData.totalSlots} onChange={handleEditInputChange} required min="1"
                                className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-1">Latitude</label>
                        <input type="number" step="any" name="latitude" value={editFormData.latitude} onChange={handleEditInputChange} required
                                className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-1">Longitude</label>
                        <input type="number" step="any" name="longitude" value={editFormData.longitude} onChange={handleEditInputChange} required
                                className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-1">Current Cover Image</label>
                        {editFormData.currentCoverImageUrl ? (
                            <img src={editFormData.currentCoverImageUrl} alt="Current cover" className="w-full h-auto max-h-40 object-contain rounded border p-1 mb-2"/>
                        ) : (
                            <p className="text-sm text-secondary-500 mb-2">No current image.</p>
                        )}
                         <label className="block text-sm font-medium text-secondary-700 mb-1">Upload New Cover Image (Optional)</label>
                         <div className="flex items-center">
                            <label className="flex items-center px-4 py-2 bg-secondary-100 text-secondary-700 rounded-md cursor-pointer hover:bg-secondary-200 transition-colors">
                                <Upload className="h-5 w-5 mr-2" /> Choose File
                                <input type="file" name="coverImage" ref={editFileInputRef} onChange={handleEditInputChange} accept="image/*" className="hidden"/>
                            </label>
                            {editFormData.coverImage && (<span className="ml-3 text-sm text-secondary-600">{editFormData.coverImage.name}</span>)}
                        </div>
                    </div>
                </div>
                <div className="mt-8 flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                    <button type="button" onClick={() => { setShowEditModal(false); setEditingLocation(null); clearMessages(); if(editFileInputRef.current) editFileInputRef.current.value = "";}}
                            className="px-4 py-2 bg-secondary-200 text-secondary-700 rounded-md hover:bg-secondary-300 transition-colors w-full sm:w-auto disabled:opacity-50"
                            disabled={actionInProgress}>
                        Cancel
                    </button>
                    <button type="submit" disabled={actionInProgress}
                            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors flex items-center justify-center w-full sm:w-auto disabled:opacity-50">
                        <Save className="h-5 w-5 mr-2" /> Save Changes
                    </button>
                </div>
            </form>
        </div>
      )}

      {/* Locations Grid/List */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : !error && locations.length === 0 ? (
        <div className="text-center py-10">
            <Building size={48} className="mx-auto text-secondary-400 mb-4" />
            <p className="text-secondary-600">No parking locations found. Click "Add Location" to get started.</p>
        </div>
      ) : !error ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {locations.map(location => (
            <div key={location.id} className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col">
              <img
                src={location.coverImageUrl || 'https://via.placeholder.com/400x200.png?text=No+Image'} // Fallback image
                alt={location.name}
                className="w-full h-48 object-cover"
              />
              <div className="p-5 flex flex-col flex-grow">
                <h3 className="text-xl font-semibold text-secondary-900 mb-2">{location.name}</h3>
                <div className="space-y-1 text-sm text-secondary-600 mb-3 flex-grow">
                  <p><strong>Total Slots:</strong> {location.totalSlots}</p>
                  <p><strong>Available:</strong> {location.availableSlots}</p>
                  <p><strong>Rating:</strong> {location.averageRating?.toFixed(1) ?? 'N/A'} ⭐ ({location.feedbackCount ?? 0} reviews)</p>
                  <p className="flex items-center text-xs">
                    <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
                    {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                  </p>
                </div>
                <div className="mt-auto pt-3 border-t border-secondary-200 flex justify-end space-x-2">
                    <button 
                        onClick={() => handleEditClick(location)}
                        disabled={actionInProgress}
                        className="p-2 text-primary-600 hover:text-primary-800 rounded-full hover:bg-primary-100 transition-colors disabled:opacity-50"
                        title="Edit Location">
                        <Edit3 size={18}/>
                    </button>
                    <button 
                        onClick={() => handleDeleteClick(location.id)}
                        disabled={actionInProgress}
                        className="p-2 text-red-600 hover:text-red-800 rounded-full hover:bg-red-100 transition-colors disabled:opacity-50"
                        title="Delete Location">
                        <Trash2 size={18}/>
                    </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null }
    </div>
  );
};

export default AdminLocations;