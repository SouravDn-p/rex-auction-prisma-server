import cloudinary from "../../config/cloudinary/cloudinary.ts";

export interface UploadResult {
  secure_url: string;
  public_id: string;
}

const uploadImage = async (
  fileBuffer: Buffer,
  folder = "uploads"
): Promise<UploadResult> => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          resource_type: "image",
        },
        (error, result) => {
          if (error) {
            return reject(error);
          }

          resolve({
            secure_url: result!.secure_url,
            public_id: result!.public_id,
          });
        }
      )
      .end(fileBuffer);
  });
};

const deleteImage = async (publicId: string) => {
  return cloudinary.uploader.destroy(publicId);
};

export const CloudinaryService = {
  uploadImage,
  deleteImage,
};