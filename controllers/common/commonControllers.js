// * Controllers 기본 구조
//  1) router 및 initRoute repuire
const router = require('express').Router(); // express의 Router 객체 생성(모듈 로드)
const { initRoute } = require('../../routes/common_routes'); // 라우트 작성
const { sendQuery } = require('../../config/database');

const path = require('path'); // path 관련 기능 모듈
const fs = require('fs'); // File system 모듈
const upload = require('../../config/upload'); // multer 관련 설정

//  2) 통신 객체 배열 선언
const commonControllers = [
  // 코드 리스트 조회
  {
    url: '/code/:codeClass',
    type: 'get',
    callback: async ({ request, params }) => {
      try {
        const result = await sendQuery(
          'select * from code_detail where code_class = $1',
          [params.codeClass]
        );
        return {
          message: 'success',
          success: true,
          data: result, // 코드 리스트 조회 데이터
        };
      } catch (error) {
        console.log(`/common/code error : ${error.message}`);
        return {
          message: 'error',
          success: false,
        };
      }
    },
  },

  // 통합 업로드
  {
    url: '/file/upload',
    // 업로드 파일이 있는 경우 이와 같은 형태로 선언
    // 파일이 1개 일 때 : upload: upload.single(''),
    // params의 file에서 받을 수 있도록 처리 key 로 받을 수 있게 할지는 좀 생각해보고...
    // 파일이 다수 일 때 : upload: upload.array([]]),  이거 일듯 ?
    upload: upload.array('file'),
    // upload: upload.single('file'),
    type: 'post',
    callback: async ({ request, params }) => {
      try {
        if (!request.isAuthenticated()) {
          // 비인증 접근 > 프론트로 비인증 여부 전달
          return {
            message: 'noAuth',
            success: false,
          };
        }

        const userId = request.user.userId;
        const { files } = params;

        if (!files || files.length == 0) {
          return {
            message: 'noFile',
            success: false,
          };
        }

        if (!isValidFile(files, allowedFiles)) {
          // 파일 업로드 허용 체크
          return {
            message: 'noAllowFile',
            success: false,
          };
        }

        const result = await uploadProc(files, params.fileId, userId);

        return {
          message: 'success',
          success: true,
          ...result,
        };
      } catch (error) {
        console.log(`/common/file/upload error : ${error.message}`);
        return {
          message: 'error',
          success: false,
        };
      }
    },
  },

  // 이미지 업로드
  {
    url: '/file/image/upload',
    upload: upload.array('file'),
    type: 'post',
    callback: async ({ request, params }) => {
      try {
        if (!request.isAuthenticated()) {
          // 비인증 접근 > 프론트로 비인증 여부 전달
          return {
            message: 'noAuth',
            success: false,
          };
        }

        const userId = request.user.userId;
        const { files } = params;

        if (!files || files.length == 0) {
          return {
            message: 'noFile',
            success: false,
          };
        }

        if (!isValidFile(files, allowedImages)) {
          // 파일 업로드 허용 체크
          return {
            message: 'noAllowFile',
            success: false,
          };
        }

        const result = await uploadProc(files, params.fileId, userId);

        return {
          message: 'success',
          success: true,
          ...result,
        };
      } catch (error) {
        console.log(`/common/file/image/upload error : ${error.message}`);
        console.log(error);
        return {
          message: 'error',
          success: false,
        };
      }
    },
  },

  // 문서 업로드
  {
    url: '/file/doc/upload',
    upload: upload.array('file'),
    type: 'post',
    callback: async ({ request, params }) => {
      try {
        if (!request.isAuthenticated()) {
          // 비인증 접근 > 프론트로 비인증 여부 전달
          return {
            message: 'noAuth',
            success: false,
          };
        }

        const userId = request.user.userId;
        const { files } = params;

        if (!files || files.length == 0) {
          return {
            message: 'noFile',
            success: false,
          };
        }

        if (!isValidFile(files, allowedDocuments)) {
          // 문서 파일 업로드 허용 체크
          return {
            message: 'noAllowedFile',
            success: false,
          };
        }

        const result = await uploadProc(files, params.fileId, userId);

        return {
          message: 'success',
          success: true,
          ...result,
        };
      } catch (error) {
        console.log(`/common/file/doc/upload error : ${error.message}`);
        return {
          message: 'error',
          success: false,
        };
      }
    },
  },

  // group_id 수정
  {
    url: '/file/update/groupId',
    type: 'patch',
    callback: async ({ request, params }) => {
      try {
        if (!request.isAuthenticated()) {
          // 비인증 접근 > 프론트로 비인증 여부 전달
          return {
            message: 'noAuth',
            success: false,
          };
        }

        const result = await sendQuery(
          'update file set file_group_id = $1 where file_group_id = $2',
          [String(params.newGroupId), String(params.groupId)]
        );
        return {
          message: 'success',
          success: true,
        };
      } catch (error) {
        console.log(`/common/file/doc/upload error : ${error.message}`);
        return {
          message: 'error',
          success: false,
        };
      }
    },
  },

  {
    url: '/file/:fileId',
    type: 'get',
    callback: async ({ request, params, response }) => {
      try {
        const fileInfo = await sendQuery(
          'select * from file where file_id = $1',
          [Number(params.fileId)]
        );
        const filePath = path.resolve(
          process.cwd(),
          'public',
          fileInfo[0].fileName
        );
        // 파일 존재 여부 확인 후 전송
        const checkFile = (filePath) => {
          return new Promise((resolve) => {
            fs.access(filePath, fs.constants.F_OK, (err) => {
              if (err) {
                resolve({ success: false, message: 'error' });
              } else {
                resolve({ isFile: true, filePath });
              }
            });
          });
        };

        // 사용 예시 (async 함수 안에서)
        const result = await checkFile(filePath);

        return result;
      } catch (error) {
        console.log(`/common/file/:fileId error : ${error.message}`);
        return {
          message: 'error',
          success: false,
        };
      }
    },
  },
];

const uploadProc = async (files, fileId, userId) => {
  const fileIdArr = [];
  const timestamp = Date.now(); // 밀리세컨드 타임스탬프 조회 : ex) 1720084512345
  for (let idx = 0; idx < files.length; idx++) {
    // foreach 는 비동기를 안기다려줌...왜????
    const file = files[idx];
    const sendFileId =
      fileId == undefined || fileId.length == 0
        ? undefined
        : fileId[idx] == undefined || fileId[idx].length == 0
        ? undefined
        : fileId[idx];
    const result = await uploadFile({
      file,
      sendFileId,
      userId,
      groupOder: idx,
      timestamp,
    });
    fileIdArr.push(result);
  }
  return {
    fileIdArr: fileIdArr,
    groupId: timestamp,
  };
};

const uploadFile = async ({ file, fileId, userId, groupOrdr, timestamp }) => {
  const { originalname, mimetype, size } = file;

  const ext = path.extname(originalname); // 확장자 조회
  const fileName = `${timestamp}${ext}`;
  fs.writeFileSync(
    path.resolve(process.cwd(), 'public', fileName),
    file.buffer // 이미지 버퍼 저장
  );

  const insertQueryParam = [
    timestamp,
    userId,
    fileName,
    originalname,
    `/public/${fileName}`,
    size,
    mimetype,
    groupOrdr,
  ];

  if (!(fileId == undefined || fileId == '')) {
    insertQueryParam.push(fileId);
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
                            ${
                              !(fileId == undefined || fileId == '')
                                ? ',file_id'
                                : ''
                            } 
                        ) values (
                            $1, $2, $3, $4, $5, $6, $7, $8 
                            ${
                              !(fileId == undefined || fileId == '')
                                ? ',$9'
                                : ''
                            }
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
};

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
  });
  return valid;
}

// 파일 업로드 허용 목록 관련
// 문서 허용
const allowedDocuments = {
  extensions: [
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
    '.hwp',
  ],
  mimetypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/x-hwp',
  ],
};

// 이미지 허용
const allowedImages = {
  extensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'],
  mimetypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/webp',
  ],
};

const allowedFiles = {
  extensions: [...allowedDocuments.extensions, ...allowedImages.extensions],
  mimetypes: [...allowedDocuments.mimetypes, ...allowedImages.mimetypes],
};

// 업로드 제한 확장자 목록
const blockedExtensions = [
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.vbs',
  '.js',
  '.jar',
  '.ps1',
  '.msi',
  '.php',
  '.asp',
  '.jsp',
  '.cgi',
  '.pl',
  '.py',
  '.html',
  '.htm',
  '.svg',
  '.xhtml',
  '.docm',
  '.xlsm',
  '.pptm',
  '.lnk',
  '.reg',
  '.iso',
  '.db',
  '.bak',
  '.torrent',
];

//  3) 통신 객체 배열 Route 등록
commonControllers.forEach((route) => {
  initRoute(router, route);
});

module.exports = router;
