const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Create directories if they don't exist
const publicDir = path.join(__dirname, 'public');
const imagesDir = path.join(publicDir, 'images');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
  console.log('Created public directory');
}

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir);
  console.log('Created images directory');
}

// List of images to download
const imagesToDownload = [
  {
    name: 'register-bg.jpg',
    url: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=1949&auto=format&fit=crop',
    fallback: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=2070&auto=format&fit=crop'
  },
  {
    name: 'login-bg.jpg',
    url: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=2070&auto=format&fit=crop',
    fallback: 'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?q=80&w=2070&auto=format&fit=crop'
  }
];

// Function to download an image
function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (response) => {
      // Check if the response is successful
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${response.statusCode}`));
        return;
      }
      
      // Create a write stream to save the image
      const fileStream = fs.createWriteStream(path.join(imagesDir, filename));
      
      // Pipe the response to the file
      response.pipe(fileStream);
      
      // Handle errors during download
      fileStream.on('error', (err) => {
        reject(err);
      });
      
      // Resolve when the download is complete
      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`Downloaded ${filename} successfully`);
        resolve();
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Download all images
async function downloadAllImages() {
  console.log('Starting image downloads...');
  
  for (const image of imagesToDownload) {
    try {
      console.log(`Downloading ${image.name} from ${image.url}`);
      await downloadImage(image.url, image.name);
    } catch (err) {
      console.error(`Error downloading ${image.name} from primary URL:`, err.message);
      
      if (image.fallback) {
        try {
          console.log(`Trying fallback URL for ${image.name}: ${image.fallback}`);
          await downloadImage(image.fallback, image.name);
        } catch (fallbackErr) {
          console.error(`Error downloading ${image.name} from fallback URL:`, fallbackErr.message);
        }
      }
    }
  }
  
  console.log('Image downloads completed');
  console.log(`Images are available at: ${imagesDir}`);
  
  // List all downloaded images
  const downloadedImages = fs.readdirSync(imagesDir);
  console.log('Downloaded images:', downloadedImages);
}

// Run the download function
downloadAllImages().catch(err => {
  console.error('Error in download process:', err);
}); 