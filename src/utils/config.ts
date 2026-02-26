/**
 * App configuration
 */

export const config = {
  // API base URL - update this to match your backend URL
  apiBaseUrl: __DEV__
    // ? 'http://192.168.111.65:5001' // Office
     ? 'http://192.168.10.30:5001' // Home
    : 'https://api.everhome.com', // Production

  // Gemini API base URL for image transformation
  geminiApiBaseUrl: __DEV__
    //? 'http://192.168.111.65:5001' // Office
     ? 'http://192.168.10.30:5001' // Home
    : 'https://api.everhome.com', // Production

  // API timeout in milliseconds
  apiTimeout: 30000,

  // Image transformation timeout (longer for AI processing)
  imageTransformTimeout: 120000,

  // App version
  appVersion: '1.0.0', 

  // Support email
  supportEmail: 'info@softsfab.com',
};

export default config;
