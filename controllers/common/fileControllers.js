const { sendQuery } = require('../../config/database');

const path = require('path'); // path 관련 기능 모듈
const fs = require('fs'); // File system 모듈

const uploadProc = async (files, fileId, userId) => {
  const fileIdArr = [];
  const timestamp = Date.now(); // 밀리세컨드 타임스탬프 조회 : ex) 1720084512345
  for (let idx = 0; idx < files.length; idx++) { // foreach 는 비동기를 안기다려줌...왜????
      const file = files[idx];
      const sendFileId = ( fileId == undefined || fileId.length == 0 ? 
          undefined : (fileId[idx] == undefined || fileId[idx].length == 0 ? undefined : fileId[idx]))
      const result = await uploadFile({file, sendFileId, userId, groupOder:idx, timestamp});
      fileIdArr.push(result);
  }
  return {
      fileIdArr:fileIdArr,
      groupId:timestamp
  };
}

const uploadFile = async ({file, fileId, userId, groupOrdr, timestamp}) => {
  // console.log("Upload : ",file);
  const { originalname, mimetype, size } = file;
  
  const ext = path.extname(originalname); // 확장자 조회
  const fileName = `${timestamp}${ext}`;

  const dataBuffer = Buffer.isBuffer(file.buffer) ? buffer : Buffer.from(file.buffer.data);

  fs.writeFileSync(
      path.resolve(process.cwd(), 'public', fileName),
      dataBuffer
  );

  const insertQueryParam = [
      timestamp, userId, fileName, originalname, `/public/${fileName}`, size, mimetype, groupOrdr
  ]

  if(!(fileId == undefined || fileId == "")){
      insertQueryParam.push(fileId)
  }

  const insertQuery = `insert into file (
                          file_group_id,
                          user_id,
                          file_name,
                          file_origin_name,
                          file_path,
                          file_size,
                          file_type,
                          file_group_ordr
                          ${!(fileId == undefined || fileId == "") ? ',file_id' : ''} 
                      ) values (
                          $1, $2, $3, $4, $5, $6, $7, $8 
                          ${!(fileId == undefined || fileId == "") ? ',$9' : ''}
                      )
                      on conflict (file_id)
                      do update set
                          file_group_id = $1,
                          user_id = $2,
                          file_name = $3,
                          file_origin_name = $4,
                          file_path = $5,
                          file_size = $6,
                          file_type = $7,
                          file_group_ordr = $8
                      returning file_id`;

  const result = await sendQuery(insertQuery, insertQueryParam);
  return result[0].fileId;
}


// 파일 업로드 허용 체크
function isValidFile(files, allowed) {
  let valid = true;
  files.forEach((file) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const mime = file.mimetype;
  
      // 1. 확장자 금지
      if (blockedExtensions.includes(ext)) {
          valid = false;
      }
  
      // 2. 허용된 확장자 및 mimetype 확인
      if (!allowed.extensions.includes(ext)) {
          valid = false;
      }
  
      if (!allowed.mimetypes.includes(mime)) {
          valid = false;
      }
  })
  return valid;
}

// 파일 업로드 허용 목록 관련
// 문서 허용
const allowedDocuments = {
  extensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.hwp'],
  mimetypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/x-hwp'
  ]
};

// 이미지 허용
const allowedImages = {
  extensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'],
  mimetypes: ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp']
};

const allowedFiles = {
  extensions: [
      ...allowedDocuments.extensions,
      ...allowedImages.extensions
  ],
  mimetypes: [
      ...allowedDocuments.mimetypes,
      ...allowedImages.mimetypes
  ]
};

// 업로드 제한 확장자 목록
const blockedExtensions = [
  '.exe', '.bat', '.cmd', '.sh', '.vbs', '.js', '.jar', '.ps1', '.msi',
  '.php', '.asp', '.jsp', '.cgi', '.pl', '.py',
  '.html', '.htm', '.svg', '.xhtml',
  '.docm', '.xlsm', '.pptm',
  '.lnk', '.reg', '.iso', '.db', '.bak', '.torrent'
];

const uploadFileImage = async (files, userId)=>{
  
  if(!files || files.length == 0){
    return {
        message: 'noFile',
        success: false
    }
  }

  if(!isValidFile(files, allowedImages)){ // 파일 업로드 허용 체크
      return {
          message: 'noAllowFile',
          success: false
      }
  }
  const timestamp = Date.now(); 
  const result = await uploadProc(files,undefined,userId);
  return result;
}

module.exports = {isValidFile, uploadProc, uploadFile, uploadFileImage}