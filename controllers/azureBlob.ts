import { BlobServiceClient } from '@azure/storage-blob';

// Replace with your Azure Blob Storage connection string and container name
const connectionString = 'TOKEN_GOES_HERE';
const containerName = 'viclesdev';

interface ImagePack {
  cover: string;
  images: string[];
}

export interface UploadResult {
  coverUrl: string;
  imageUrls: string[];
}

export async function uploadImages(imagePack: ImagePack, baseObjectName: string): Promise<UploadResult> {
  // Create a BlobServiceClient instance
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);

  // Get a reference to the container
  const containerClient = blobServiceClient.getContainerClient(containerName);

  // Function to upload a single image and return its URL
  async function uploadSingleImage(base64Image: string, fileName: string): Promise<string> {
    const blobClient = containerClient.getBlockBlobClient(fileName);
    
    // Remove the data URL prefix if it exists
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    
    const buffer = Buffer.from(base64Data, 'base64');
    await blobClient.upload(buffer, buffer.length, { 
      blobHTTPHeaders: { 
        blobContentType: 'image/webp',
        blobContentEncoding: 'base64'
      } 
    });
    return blobClient.url;
  }

  try {
    // Upload cover image
    const coverFileName = `${baseObjectName}-cover.webp`;
    const coverUrl = await uploadSingleImage(imagePack.cover, coverFileName);
	
    // Upload all images concurrently
    const imageUrls = await Promise.all(
      imagePack.images.map((image, index) => 
        uploadSingleImage(image, `${baseObjectName}-image-${index + 1}.webp`)
      )
    );


    // Return object with all image URLs
    return {
      coverUrl,
      imageUrls
    };
  } catch (error) {
    console.error('Error uploading images:', error);
    throw error; // Re-throw the error to handle it in the calling code
  }
}