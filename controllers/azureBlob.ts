import { BlobServiceClient } from '@azure/storage-blob';

// Replace with your Azure Blob Storage connection string and container name
const connectionString = 'DefaultEndpointsProtocol=https;AccountName=viclesimagestore;AccountKey=TjZTlAXMjU4E6K8vN/vVdltWvgxZo3Pzq2oyWmFTCFPzxGEm4Dz/aQo0s+IZi8KuGLULASw71Bda+ASta265xQ==;EndpointSuffix=core.windows.net';
const containerName = 'viclesdev';

interface ImagePack {
  cover: string;
  images: string | string[];
}

interface UploadResult {
  coverUrl: string;
  imageUrls: string[];
}

export async function uploadImages(imagePack: ImagePack, baseObjectName: string): Promise<UploadResult> {
  try {
    // Create a BlobServiceClient instance
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);

    // Get a reference to the container
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // Function to upload a single image and return its URL
    async function uploadSingleImage(base64Image: string, fileName: string): Promise<string> {
      const blobClient = containerClient.getBlockBlobClient(fileName);
      const buffer = Buffer.from(base64Image, 'base64');
      await blobClient.upload(buffer, buffer.length, { blobHTTPHeaders: { blobContentType: 'image/jpeg' } });
      return blobClient.url;
    }

    // Upload cover image
    const coverFileName = `${baseObjectName}-cover.jpg`;
    const coverUrl = await uploadSingleImage(imagePack.cover, coverFileName);

    // Handle images, whether it's a single string or an array
    let imageUrls: string[] = [];
    if (typeof imagePack.images === 'string') {
      // If images is a single string, upload it as one image
      const imageFileName = `${baseObjectName}-image-1.jpg`;
      const imageUrl = await uploadSingleImage(imagePack.images, imageFileName);
      imageUrls.push(imageUrl);
    } else if (Array.isArray(imagePack.images)) {
      // If images is an array, upload each image
      imageUrls = await Promise.all(imagePack.images.map((image, index) => 
        uploadSingleImage(image, `${baseObjectName}-image-${index + 1}.jpg`)
      ));
    }

    console.log('All images uploaded successfully!');

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