import React, { useState } from 'react';

interface UserChoiceProps {
    onOptionSelect: (option: 'create' | 'nash') => void;
}

export default function UserChoice({ onOptionSelect }: UserChoiceProps) {
    const [selectedOption, setSelectedOption] = useState<string | null>(null);

    const handleOptionClick = (option: 'create' | 'nash') => {
        setSelectedOption(option);
        // Add a small delay for visual feedback
        setTimeout(() => {
            onOptionSelect(option);
        }, 200);
    };

    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'white',
            fontFamily: 'Arial, sans-serif'
        }}>
            {/* Header */}
            <div style={{
                textAlign: 'center',
                marginBottom: '50px',
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
                    Choose your preferred modeling option
                </p>
            </div>

            {/* Main Options Container */}
            <div style={{
                display: 'flex',
                gap: '60px',
                justifyContent: 'center',
                flexWrap: 'wrap'
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
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: selectedOption === 'create' 
                            ? '0 12px 40px rgba(76, 175, 80, 0.3)' 
                            : '0 8px 32px rgba(0,0,0,0.1)',
                        transform: selectedOption === 'create' ? 'translateY(-8px)' : 'none',
                        border: selectedOption === 'create' ? '3px solid #45a049' : '2px solid #e9ecef'
                    }}
                    onMouseEnter={(e) => {
                        if (selectedOption !== 'create') {
                            e.currentTarget.style.transform = 'translateY(-5px)';
                            e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.15)';
                            e.currentTarget.style.backgroundColor = '#f1f3f4';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (selectedOption !== 'create') {
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
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: selectedOption === 'nash' 
                            ? '0 12px 40px rgba(255, 152, 0, 0.3)' 
                            : '0 8px 32px rgba(0,0,0,0.1)',
                        transform: selectedOption === 'nash' ? 'translateY(-8px)' : 'none',
                        border: selectedOption === 'nash' ? '3px solid #F57C00' : '2px solid #e9ecef'
                    }}
                    onMouseEnter={(e) => {
                        if (selectedOption !== 'nash') {
                            e.currentTarget.style.transform = 'translateY(-5px)';
                            e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.15)';
                            e.currentTarget.style.backgroundColor = '#f1f3f4';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (selectedOption !== 'nash') {
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

            {/* Footer */}
            <div style={{
                position: 'absolute',
                bottom: '20px',
                color: '#999',
                fontSize: '12px',
                textAlign: 'center'
            }}>
                Building Model Interface v1.0 | Select an option to continue
            </div>
        </div>
    );
}