// Multer 세팅 : 업로드
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage });
module.exports = upload;
