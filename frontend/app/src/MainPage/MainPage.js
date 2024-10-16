import React, { useState, useEffect } from 'react';
import CameraCapture from './Camera';
import Tesseract from 'tesseract.js';
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, deleteDoc, where, query } from 'firebase/firestore';
import '../MainPage.css';
import SignOut from '../SignOut';  // Import the new SignOut component
import ManualUpload from './ManualUpload';
import { useNavigate } from "react-router-dom";
import ReceiptConfirm from './ReceiptConfirm';



const db = getFirestore();

const Dashboard = ({ user }) => { 
    const [receipts, setReceipts] = useState([]);
    const [showCamera, setShowCamera] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(true);
    const [showPopup, setShowPopup] = useState(false);
    const [receiptDetails, setReceiptDetails] = useState({ vendor: '', total: '', date: '', category: ''});

    // Fetch username and receipts from Firestore
    useEffect(() => {
        const fetchUserData = async () => {
            if (user) {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    setUsername(userDoc.data().username || 'User');
                }
            }
            setLoading(false);
        };

        const fetchReceipts = async () => {
            try {
                const q = query(collection(db, 'receipts'), where('userId', '==', user.uid));
                const querySnapshot = await getDocs(q);
                const receiptData = [];
                querySnapshot.forEach((doc) => {
                    receiptData.push({ ...doc.data(), id: doc.id });
                });
                setReceipts(receiptData);
            } catch (error) {
                console.error('Error fetching receipts: ', error);
            }
        };

        fetchUserData();
        fetchReceipts();
    }, [user]);

    const handleReceiptUpload = (event) => {
        const file = event.target.files[0];
        setSelectedFile(file ? file.name : null);
        processReceipt(file);
    };

    const handleReceiptCapture = async (imageSrc) => {
        try {
            const base64Response = await fetch(imageSrc);
            const blob = await base64Response.blob();
            const file = new File([blob], 'captured-image.jpg', { type: 'image/jpeg' });
            processReceipt(file);
        } catch (error) {
            console.error('Error capturing image: ', error);
        }
    };

    const processReceipt = async (file) => {
        const formData = new FormData();
        formData.append('file', file);
    
        try {
            // Send the file to the backend for processing using Veryfi
            const response = await fetch('http://localhost:5000/api/process-receipt', {
                method: 'POST',
                body: formData,
            });
    
            if (!response.ok) {
                throw new Error('Failed to process the receipt');
            }
    
            // Extract the JSON response from the backend
            const data = await response.json();
            console.log('Backend Response:', data);
    
            // Set the receipt details received from the backend for user confirmation
            setReceiptDetails({
                userId: user.uid,
                vendor: data.vendor || '',
                total: data.total || '',
                date: data.date || '',
                category: data.category || '',
            });
    
            // Open the pop-up for confirmation
            setShowPopup(true);
            
        } catch (error) {
            // Handle any errors that occur during the fetch or response processing
            console.error('Error uploading the receipt:', error);
        }
    };

    const handleReceiptConfirm = async () => {
        try {
            // Save the confirmed receipt details to Firestore
            await addDoc(collection(db, 'receipts'), {
                userId: user.uid,
                vendor: receiptDetails.vendor,
                total: receiptDetails.total,
                date: receiptDetails.date,
                category: receiptDetails.category,
                timestamp: new Date(), // Add a timestamp for each receipt
            });
    
            console.log('Receipt saved successfully');
            setShowPopup(false); // Close the pop-up after saving
            fetchReceipts();
        } catch (error) {
            console.error('Error saving receipt:', error);
        }
    };

    const handleReceiptChange = (e) => {
        setReceiptDetails({ ...receiptDetails, [e.target.name]: e.target.value });
    };

    const handleReceiptCancel = () => {
        setShowPopup(false); // Close the pop-up without saving
        console.log('Receipt addition cancelled');
    };

    const fetchReceipts = async () => {
        try {
            if (user) {
                // Query only receipts where userId matches the current user
                const querySnapshot = await getDocs(
                    collection(db, 'receipts'),
                    where('userId', '==', user.uid) // Filter by userId
                );
                const receiptData = [];
                querySnapshot.forEach((doc) => {
                    receiptData.push({ ...doc.data(), id: doc.id });
                });
                setReceipts(receiptData);
            }
        } catch (error) {
            console.error('Error fetching receipts: ', error);
        }
    };

    const deleteReceipt = async (id) => {
        try {
            await deleteDoc(doc(db, 'receipts', id)); 
            fetchReceipts(); // Refresh receipts after deletion
        } catch (error) {
            console.error('Error deleting receipt: ', error);
        }
    };
    const navigate = useNavigate()

    return (
        <div>
            <div className="header">
                <h1>Welcome, {loading ? 'Loading...' : username}!</h1> {/* Display username or loading */}
            </div>
            <button
                onClick={() => navigate("/record")}
            >
                Manual Upload
            </button>
            {/* <div className="dashboard-title">
                <h2>Dashboard</h2>
            </div> */}
            <button onClick={() => setShowCamera(!showCamera)}>
                {showCamera ? 'Switch to Upload' : 'Scan with Camera'}
            </button>

            {showCamera ? (
                <CameraCapture onCapture={handleReceiptCapture} />
            ) : (
                <div className="upload-container" onClick={() => document.getElementById('file-input').click()}>
                    {selectedFile ? (
                        <p>{selectedFile}</p>
                    ) : (
                        <p>Drag or upload your document here</p>
                    )}
                    <input
                        id="file-input"
                        type="file"
                        accept="image/*"
                        onChange={handleReceiptUpload}
                        style={{ display: 'none' }}
                    />
                </div>
            )}
            <h2>Your Receipts:</h2>
            <ul>
                {receipts.map(receipt => (
                    <li key={receipt.id}>
                        <div>
                            <span>Vendor: {receipt.vendor}</span><br />
                            <span>Total: {receipt.total}</span><br />
                            <span>Date: {receipt.date}</span><br />
                            <span>Category: {receipt.category}</span>
                        </div>
                        <button className="delete-button" onClick={() => deleteReceipt(receipt.id)}>
                            Delete
                        </button>
                    </li>
                ))}
            </ul>
            {showPopup && (
                <ReceiptConfirm 
                  receiptDetails={receiptDetails} 
                  onConfirm={handleReceiptConfirm}
                  onCancel={handleReceiptCancel}
                  onChange={handleReceiptChange} 
                />
            )}
        </div>
    );
};

export default Dashboard;
