const cloudinary = require("../Config/cloudinary");
const streamifier = require("streamifier");

/**
 * Upload buffer to Cloudinary
 * @param {Buffer} buffer 
 * @param {String} folder 
 * @param {String} publicIdPrefix 
 */
function uploadBufferToCloudinary(
  buffer,
  folder = "misc",
  publicIdPrefix = ""
) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `leatherhaven/${folder}`,
        public_id: publicIdPrefix || undefined,
        resource_type: "auto", // 🔥 image + pdf support
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

module.exports = { uploadBufferToCloudinary };
