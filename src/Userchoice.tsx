import React, { useState } from 'react';

interface UserChoiceProps {
    onOptionSelect: (option: 'create' | 'nash') => void;
}

export default function UserChoice({ onOptionSelect }: UserChoiceProps) {
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [buildingTypology, setBuildingTypology] = useState<string>('');
    const [builtUpArea, setBuiltUpArea] = useState<string>('');
    const [occupancy, setOccupancy] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

    const buildingTypologies = [
        'Single-Family Detached House',
        'Duplex / Semi-Detached House',
        'Townhouse / Row House',
        'Apartment / Flat / Condominium',
        'High-Rise Residential Building',
        'Dormitory / Hostel',
        'Senior Living / Assisted Living',
        'Preschool / Kindergarten',
        'Primary / Elementary School',
        'Secondary / High School',
        'College / University',
        'Vocational / Training Institute',
        'Research Facility (Educational)',
        'Office Building',
        'Co-Working Spaces',
        'Retail Store / Showroom',
        'Shopping Mall / Plaza',
        'Supermarket / Hypermarket',
        'Hotel 1 Star',
        'Hotel 2 Star',
        'Hotel 3 Star',
        'Hotel 4 Star',
        'Hotel 5 Star',
        'Restaurant / Cafe / Food Court',
        'Bank / Financial Institution',
        'Data Center',
        'Factory / Workshop',
        'Warehouse / Storage Facility',
        'Cold Storage',
        'Power Plant',
        'Refinery / Processing Plant',
        'Research & Development Lab (Industrial)',
        'Hospital',
        'Clinic / Polyclinic',
        'Diagnostic Lab',
        'Dental Center',
        'Rehabilitation Center',
        'Nursing Home',
        'Government Office / Civic Center',
        'Courthouse / Judicial Building',
        'Police Station',
        'Fire Station',
        'Correctional Facility / Jail',
        'Parliament / Assembly Building',
        'Theater / Auditorium',
        'Cinema Hall',
        'Convention Center',
        'Religious Building (Church, Mosque, Temple)',
        'Community Hall',
        'Stadium / Sports Arena',
        'Airport Terminal',
        'Train / Metro Station',
        'Bus Terminal',
        'Museum',
        'Gallery',
        'Library'
    ];

    // Filter building typologies based on search term
    const filteredTypologies = buildingTypologies.filter(type =>
        type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleOptionClick = (option: 'create' | 'nash') => {
        if (!buildingTypology || !builtUpArea || !occupancy) {
            alert('Please fill in all required fields before proceeding.');
            return;
        }
        
        setSelectedOption(option);
        // Add a small delay for visual feedback
        setTimeout(() => {
            onOptionSelect(option);
        }, 200);
    };

    const handleTypologySelect = (type: string) => {
        setBuildingTypology(type);
        setSearchTerm('');
        setIsDropdownOpen(false);
    };

    const isFormComplete = buildingTypology && builtUpArea && occupancy;

    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'white',
            fontFamily: 'Arial, sans-serif',
            overflow: 'auto',
            padding: '20px'
        }}>
            {/* Header */}
            <div style={{
                textAlign: 'center',
                marginBottom: '30px',
                color: '#333'
            }}>
                <h1 style={{
                    fontSize: '48px',
                    fontWeight: 'bold',
                    margin: '0 0 10px 0',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.1)'
                }}>
                    Building Model Interface
                </h1>
                <p style={{
                    fontSize: '18px',
                    opacity: 0.8,
                    margin: 0
                }}>
                    Fill in building details and choose your modeling option
                </p>
            </div>

            {/* Building Details Form */}
            <div style={{
                backgroundColor: '#f8f9fa',
                borderRadius: '16px',
                padding: '30px',
                marginBottom: '40px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                width: '100%',
                maxWidth: '600px'
            }}>
                <h3 style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    marginBottom: '25px',
                    color: '#333',
                    textAlign: 'center'
                }}>
                    Building Information
                </h3>

                {/* Building Typology Searchable Dropdown */}
                <div style={{ marginBottom: '20px', position: 'relative' }}>
                    <label style={{
                        display: 'block',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        marginBottom: '8px',
                        color: '#333'
                    }}>
                        Building Typology *
                    </label>
                    
                    {/* Selected value display or search input */}
                    <div
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        style={{
                            width: '100%',
                            padding: '12px',
                            fontSize: '16px',
                            borderRadius: '8px',
                            border: '2px solid #e9ecef',
                            backgroundColor: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}
                    >
                        <span style={{ color: buildingTypology ? '#333' : '#999' }}>
                            {buildingTypology || 'Select Building Type'}
                        </span>
                        <span style={{ fontSize: '12px', color: '#666' }}>
                            {isDropdownOpen ? '▲' : '▼'}
                        </span>
                    </div>

                    {/* Search input when dropdown is open */}
                    {isDropdownOpen && (
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Type to search building types..."
                            style={{
                                width: '100%',
                                padding: '12px',
                                fontSize: '16px',
                                borderRadius: '8px',
                                border: '2px solid #4CAF50',
                                backgroundColor: 'white',
                                marginTop: '5px'
                            }}
                            autoFocus
                        />
                    )}

                    {/* Dropdown options */}
                    {isDropdownOpen && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            backgroundColor: 'white',
                            border: '2px solid #e9ecef',
                            borderRadius: '8px',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            zIndex: 1000,
                            marginTop: '5px'
                        }}>
                            {filteredTypologies.length > 0 ? (
                                filteredTypologies.map((type, index) => (
                                    <div
                                        key={index}
                                        onClick={() => handleTypologySelect(type)}
                                        style={{
                                            padding: '12px',
                                            cursor: 'pointer',
                                            borderBottom: index < filteredTypologies.length - 1 ? '1px solid #e9ecef' : 'none',
                                            backgroundColor: 'white',
                                            transition: 'background-color 0.2s ease'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = '#f8f9fa';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = 'white';
                                        }}
                                    >
                                        {type}
                                    </div>
                                ))
                            ) : (
                                <div style={{
                                    padding: '12px',
                                    color: '#999',
                                    textAlign: 'center'
                                }}>
                                    No building types found
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Built Up Area Input */}
                <div style={{ marginBottom: '20px' }}>
                    <label style={{
                        display: 'block',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        marginBottom: '8px',
                        color: '#333'
                    }}>
                        Built Up Area (m²) *
                    </label>
                    <input
                        type="number"
                        value={builtUpArea}
                        onChange={(e) => setBuiltUpArea(e.target.value)}
                        placeholder="Enter area in square meters"
                        style={{
                            width: '100%',
                            padding: '12px',
                            fontSize: '16px',
                            borderRadius: '8px',
                            border: '2px solid #e9ecef',
                            backgroundColor: 'white'
                        }}
                    />
                </div>

                {/* Occupancy Input */}
                <div style={{ marginBottom: '10px' }}>
                    <label style={{
                        display: 'block',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        marginBottom: '8px',
                        color: '#333'
                    }}>
                        Occupancy (Number of People) *
                    </label>
                    <input
                        type="number"
                        value={occupancy}
                        onChange={(e) => setOccupancy(e.target.value)}
                        placeholder="Enter number of occupants"
                        style={{
                            width: '100%',
                            padding: '12px',
                            fontSize: '16px',
                            borderRadius: '8px',
                            border: '2px solid #e9ecef',
                            backgroundColor: 'white'
                        }}
                    />
                </div>
            </div>

            {/* Main Options Container */}
            <div style={{
                display: 'flex',
                gap: '60px',
                justifyContent: 'center',
                flexWrap: 'wrap',
                opacity: isFormComplete ? 1 : 0.5,
                transition: 'opacity 0.3s ease'
            }}>
                {/* Create Model Option */}
                <div
                    onClick={() => handleOptionClick('create')}
                    style={{
                        width: '320px',
                        height: '240px',
                        backgroundColor: selectedOption === 'create' ? '#4CAF50' : '#f8f9fa',
                        borderRadius: '16px',
                        padding: '40px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        cursor: isFormComplete ? 'pointer' : 'not-allowed',
                        transition: 'all 0.3s ease',
                        boxShadow: selectedOption === 'create' 
                            ? '0 12px 40px rgba(76, 175, 80, 0.3)' 
                            : '0 8px 32px rgba(0,0,0,0.1)',
                        transform: selectedOption === 'create' ? 'translateY(-8px)' : 'none',
                        border: selectedOption === 'create' ? '3px solid #45a049' : '2px solid #e9ecef'
                    }}
                    onMouseEnter={(e) => {
                        if (selectedOption !== 'create' && isFormComplete) {
                            e.currentTarget.style.transform = 'translateY(-5px)';
                            e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.15)';
                            e.currentTarget.style.backgroundColor = '#f1f3f4';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (selectedOption !== 'create' && isFormComplete) {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.1)';
                            e.currentTarget.style.backgroundColor = '#f8f9fa';
                        }
                    }}
                >
                    <div style={{
                        fontSize: '64px',
                        marginBottom: '20px',
                        color: selectedOption === 'create' ? 'white' : '#4CAF50'
                    }}>
                        🏗️
                    </div>
                    <h3 style={{
                        fontSize: '28px',
                        fontWeight: 'bold',
                        margin: '0 0 15px 0',
                        color: selectedOption === 'create' ? 'white' : '#333',
                        textAlign: 'center'
                    }}>
                        Create Model
                    </h3>
                    <p style={{
                        fontSize: '16px',
                        color: selectedOption === 'create' ? 'rgba(255,255,255,0.9)' : '#666',
                        textAlign: 'center',
                        margin: 0,
                        lineHeight: '1.5'
                    }}>
                        Build new 3D models from scratch with interactive tools
                    </p>
                </div>

                {/* NASH Model Option */}
                <div
                    onClick={() => handleOptionClick('nash')}
                    style={{
                        width: '320px',
                        height: '240px',
                        backgroundColor: selectedOption === 'nash' ? '#FF9800' : '#f8f9fa',
                        borderRadius: '16px',
                        padding: '40px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        cursor: isFormComplete ? 'pointer' : 'not-allowed',
                        transition: 'all 0.3s ease',
                        boxShadow: selectedOption === 'nash' 
                            ? '0 12px 40px rgba(255, 152, 0, 0.3)' 
                            : '0 8px 32px rgba(0,0,0,0.1)',
                        transform: selectedOption === 'nash' ? 'translateY(-8px)' : 'none',
                        border: selectedOption === 'nash' ? '3px solid #F57C00' : '2px solid #e9ecef'
                    }}
                    onMouseEnter={(e) => {
                        if (selectedOption !== 'nash' && isFormComplete) {
                            e.currentTarget.style.transform = 'translateY(-5px)';
                            e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.15)';
                            e.currentTarget.style.backgroundColor = '#f1f3f4';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (selectedOption !== 'nash' && isFormComplete) {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.1)';
                            e.currentTarget.style.backgroundColor = '#f8f9fa';
                        }
                    }}
                >
                    <div style={{
                        fontSize: '64px',
                        marginBottom: '20px',
                        color: selectedOption === 'nash' ? 'white' : '#FF9800'
                    }}>
                        🧠
                    </div>
                    <h3 style={{
                        fontSize: '28px',
                        fontWeight: 'bold',
                        margin: '0 0 15px 0',
                        color: selectedOption === 'nash' ? 'white' : '#333',
                        textAlign: 'center'
                    }}>
                        NASH Model
                    </h3>
                    <p style={{
                        fontSize: '16px',
                        color: selectedOption === 'nash' ? 'rgba(255,255,255,0.9)' : '#666',
                        textAlign: 'center',
                        margin: 0,
                        lineHeight: '1.5'
                    }}>
                        Use AI-powered NASH modeling for advanced analysis
                    </p>
                </div>
            </div>

            {/* Helper Text */}
            {!isFormComplete && (
                <div style={{
                    marginTop: '20px',
                    padding: '15px',
                    backgroundColor: '#fff3cd',
                    borderRadius: '8px',
                    border: '1px solid #ffeaa7',
                    color: '#856404',
                    textAlign: 'center',
                    fontSize: '14px'
                }}>
                    Please fill in all building details above to proceed with model selection
                </div>
            )}

            {/* Footer */}
            <div style={{
                position: 'absolute',
                bottom: '20px',
                color: '#999',
                fontSize: '12px',
                textAlign: 'center'
            }}>
                Building Model Interface v1.0 | Complete the form and select an option to continue
            </div>
        </div>
    );
}