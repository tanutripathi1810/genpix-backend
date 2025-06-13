import axios from "axios";
import userModel from "../models/userModel.js";
import FormData from "form-data";

export const generateImage = async (req, res) => {
    try {
        console.log("=== Image Generation Request ===");
        console.log("Headers:", req.headers);
        console.log("Body:", req.body);
        console.log("User from middleware:", req.user);
        
        // Check if API key exists and log its format (first/last few chars for security)
        const apiKey = process.env.CLIPDROP_API_KEY;
        if (!apiKey) {
            console.error("CLIPDROP_API_KEY is not set in environment variables");
            return res.json({ 
                success: false, 
                message: "Server configuration error: API key not found" 
            });
        }
        
        console.log("API Key format check:", {
            exists: !!apiKey,
            length: apiKey.length,
            prefix: apiKey.substring(0, 8) + "...",
            suffix: "..." + apiKey.substring(apiKey.length - 4)
        });

        // Get userId from req.user (set by middleware) and prompt from req.body
        const userId = req.user.id;
        const { prompt } = req.body;
        
        // Validate user exists
        const user = await userModel.findById(userId);
        if (!user) {
            console.error("User not found:", userId);
            return res.json({ success: false, message: "User not found" });
        }
        
        console.log("User found:", { 
            id: user._id, 
            creditBalance: user.creditBalance 
        });
        
        // Validate prompt
        if (!prompt || prompt.trim() === '') {
            console.error("Empty or missing prompt");
            return res.json({ success: false, message: "Prompt is required" });
        }
        
        if (prompt.trim().length > 1000) {
            console.error("Prompt too long:", prompt.trim().length);
            return res.json({ 
                success: false, 
                message: "Prompt must be 1000 characters or less" 
            });
        }

        // Check credits
        if (user.creditBalance === 0 || user.creditBalance < 0) {
            console.error("Insufficient credits:", user.creditBalance);
            return res.json({ 
                success: false, 
                message: "Insufficient credits", 
                creditBalance: user.creditBalance 
            });
        }

        // Create FormData for the API request
        const formData = new FormData();
        formData.append('prompt', prompt.trim());
        
        console.log("FormData created with prompt:", prompt.trim());
        
        // Prepare headers
        const headers = {
            'x-api-key': apiKey,
            ...formData.getHeaders()
        };
        
        console.log("Request headers:", {
            'x-api-key': apiKey.substring(0, 8) + "..." + apiKey.substring(apiKey.length - 4),
            'content-type': headers['content-type']
        });
        
        console.log("Making request to ClipDrop API...");
        
        // Make request to ClipDrop API
        const response = await axios.post(
            'https://clipdrop-api.co/text-to-image/v1', 
            formData, 
            {
                headers: headers,
                responseType: 'arraybuffer',
                timeout: 60000, // Increased to 60 seconds
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            }
        );
        
        console.log("ClipDrop API response:", {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            dataLength: response.data ? response.data.length : 0
        });
        
        // Check if response contains valid image data
        if (!response.data || response.data.length === 0) {
            throw new Error("Empty response from ClipDrop API");
        }
        
        // Convert image data to base64
        const base64Image = Buffer.from(response.data, 'binary').toString('base64');
        const resultImage = `data:image/png;base64,${base64Image}`;
        
        console.log("Image converted to base64, length:", base64Image.length);
        
        // Deduct credits from user
        const updatedUser = await userModel.findByIdAndUpdate(
            user._id, 
            { $inc: { creditBalance: -1 } }, // Use $inc for atomic decrement
            { new: true } // Return updated document
        );
        
        console.log("Credits deducted. New balance:", updatedUser.creditBalance);
        
        res.json({ 
            success: true, 
            message: "Image generated successfully", 
            image: resultImage, 
            creditBalance: updatedUser.creditBalance 
        }); 

    } catch (error) {
        console.error("=== Error in generateImage ===");
        console.error("Error type:", error.constructor.name);
        console.error("Error message:", error.message);
        
        // Handle specific error types
        if (error.response) {
            // API responded with error status
            const errorData = error.response.data;
            let errorMessage = "Unknown API error";
            
            // Try to parse error data as string if it's a buffer
            if (Buffer.isBuffer(errorData)) {
                try {
                    const errorText = errorData.toString('utf8');
                    console.error("API Error Response (as text):", errorText);
                    
                    // Try to parse as JSON
                    try {
                        const errorJson = JSON.parse(errorText);
                        errorMessage = errorJson.error || errorJson.message || errorText;
                    } catch (parseError) {
                        errorMessage = errorText;
                    }
                } catch (bufferError) {
                    console.error("Failed to convert buffer to string:", bufferError);
                }
            } else if (typeof errorData === 'string') {
                errorMessage = errorData;
            } else if (typeof errorData === 'object') {
                errorMessage = errorData.error || errorData.message || JSON.stringify(errorData);
            }
            
            console.error("API Error Details:", {
                status: error.response.status,
                statusText: error.response.statusText,
                headers: error.response.headers,
                data: errorMessage
            });
            
            if (error.response.status === 401) {
                return res.json({ 
                    success: false, 
                    message: "API authentication failed. Please verify your ClipDrop API key is correct and active.",
                    details: errorMessage
                });
            } else if (error.response.status === 429) {
                return res.json({ 
                    success: false, 
                    message: "API rate limit exceeded. Please try again in a few minutes.",
                    details: errorMessage
                });
            } else if (error.response.status === 400) {
                return res.json({ 
                    success: false, 
                    message: "Invalid request format or parameters.",
                    details: errorMessage
                });
            } else if (error.response.status === 402) {
                return res.json({ 
                    success: false, 
                    message: "API quota exceeded. Please check your ClipDrop account.",
                    details: errorMessage
                });
            } else {
                return res.json({ 
                    success: false, 
                    message: `API error (${error.response.status}): ${errorMessage}`
                });
            }
        } else if (error.request) {
            // Request was made but no response received
            console.error("No response from ClipDrop API");
            console.error("Request details:", error.request);
            return res.json({ 
                success: false, 
                message: "Failed to connect to image generation service. Please check your internet connection and try again."
            });
        } else if (error.code === 'ECONNABORTED') {
            // Timeout error
            console.error("Request timeout");
            return res.json({ 
                success: false, 
                message: "Request timeout. The image generation is taking too long. Please try again."
            });
        } else {
            // Something else happened
            console.error("Unexpected error:", error);
        }
        
        res.json({ 
            success: false, 
            message: "Image generation failed: " + error.message 
        });
    }
}