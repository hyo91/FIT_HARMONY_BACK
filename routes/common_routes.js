// 라우터, 컨트롤러, {접근 옵션들}
// 구조 분할로 정보 전달해서 차후에 수정 시 편리하게 하기 위함
const initRoute = (router, {url, callback, type, upload, auth}) => {
    try {
        let connType;
        type = type?.toLowerCase(); // 기본적으로 소문자 처리
        if(type == undefined || type == null || type == ''){ // default는 POST 방식
            connType = 'post';
        }else if(type == 'trace' || type == 'options' || type == 'connect' || type == 'track'){
            console.log(`${type} - ${url} 취약 메서드입니다. 제외합니다.`);
            return; // ISSUE : 취약점에 걸리는 METHOD 제외
        }else{
            connType = type;
        }
        // 4차 수정 - 거의 완성일 듯
        // 5차 수정 - multer 업로드 적용
        router[connType](url, auth || [], upload || [], (request, response) => {
            getBaseController({
                request : request ,
                response : response, 
                callback : callback,
                params : getParams(request) // 파라미터 죄다 뽑아내서 정제 후 반환하여 params에 저장하여 컨트롤러로 전달
            });
        }, (error, req, res, next) => { // Fail, error function
            console.log(`Controller Error ${error}`)
            return respToJson(res, 400, {
                message: 'Service Error...'
            });
        });
    } catch (error) {
        console.log(`initRoute error : ${error.message}`);
        return respToJson(response, 500, {
            message : `URL : ${url} \n Error : ${error.message}`
        });
    }
}

// initRoute와 함께 사용하기 위한 공용 Controller
const getBaseController = async ({request, response, callback, params}) => {
    try {
        const result = await callback({request, response, params});

        if (result && result.isFile && result.filePath) {
            // response sendFile 처리 시 CORS 에러가 발생해서 헤더 추가 처리
            response.setHeader('Access-Control-Allow-Origin', process.env.FRONT_DOMAIN);
            response.setHeader('Access-Control-Allow-Credentials', 'true');
            response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
            response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
            
            return response.sendFile(result.filePath);
        } else {
            return respToJson(response, 200, result);
        }
    } catch (error) {
        console.log(`getBaseController error : ${error.message}`);
        // 굳이 별도의 처리 없어도 될듯? 없는게 에러 안나네?
        // return respToJson(response, 500, {
        //     message : 'Error getBaseController : ' + error.message
        // });
    }
}

// 파라미터 정제 후 반환하여 params에 저장하여 컨트롤러로 전달하기 위한 함수
const getParams = (request) => {
    const param = {}
    
    const query = request.query;
    const params = request.params;
    const body = request.body;
    const file = request.file;
    const files = request.files;

    for(const key in query){
        param[key] = query[key];
    }

    for(const key in params){
        param[key] = params[key];
    }

    for(const key in body){
        param[key] = body[key];
    }

    if(file != undefined){
        param.file = file;
    }

    if(files != undefined){
        param.files = files;
    }
    // params == {} 는 정상적으로 비교되지 않으므로, key 개수가 0인지를 확인해서 처리
    // Object.keys(param).length
    return Object.keys(param).length == 0 ? undefined : param; // 빈객체면 그냥 undefined 반환
}

// 응답값 JSON 처리 함수
const respToJson = (response, responseCode, data) => {
    const result = response.status(responseCode).json(data)
    return result;
}


module.exports = { initRoute, respToJson }