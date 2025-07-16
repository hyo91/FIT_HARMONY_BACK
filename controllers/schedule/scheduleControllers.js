// * Controllers 기본 구조
//  1) router 및 initRoute repuire
const router = require('express').Router(); // express의 Router 객체 생성(모듈 로드)
const { initRoute } = require('../../routes/common_routes'); // 라우트 작성
const { spawn } = require('child_process'); // nodejs > python script 동작? 연결?
const path = require('path');
const dotenv = require('dotenv'); // require 메서드로 dotenv 모듈을 불러와서 환경 변수를 로드한다.
const { sendQuery, pool } = require('../../config/database');
const ROLE = require("../../config/ROLE"); // ROLE 구분 정보 객체

//  2) 통신 객체 배열 선언
const schedulerControllers = [
    // 캘린더용 스케쥴 데이터 조회( FullCalendar에서 요구하는 형태로 조회 )
    {
        url : '/calendar/:startTime/:endTime', 
        type : 'get',
        callback : async ({request, params}) => {
           try {
                if(request.isAuthenticated()){
                    let userId = request.user.userId; // 디폴트는 로그인한 사람 데이터 조회
                    
                    
                    if(request.user.role == ROLE.TRAINER){ // 강사인 경우만 회원 데이터 조회 가능
                        // querystring 으로 던짐( 강사가 > 회원 데이터 조회할 때 )
                        if(params.selectedUserId){ 
                            userId = params.selectedUserId;

                            // 매칭이 성사된 사용자(승인) 데이터만 조회 할 수 있도록 제한
                            // 승인 코드 확인 할 것...
                            const buyUser = await sendQuery("select user_id from buy where user_id = $1 and status = 'A'", [userId]);
                            if(buyUser == undefined || buyUser.length < 1){
                                return {
                                    message: 'noBuyer',
                                    success: false
                                }
                            }
                        }
                    }

                    // where 절 조건 배열
                    const selectSchedulewheres = [
                        "to_char(start_time, 'YYYY-MM-DD') >=", 
                        "and to_char(end_time, 'YYYY-MM-DD') <=",
                        "and status in"
                    ];
                    
                    // where 절 조건 파라미터 배열
                    const selectScheduleWhereParams = [
                        params.startTime, 
                        params.endTime,
                        params.status
                    ];

                    const result = await selectCalendaSchedule(selectSchedulewheres, selectScheduleWhereParams, userId);

                    return { 
                        message: 'success',
                        success: true,
                        data : result // 데이터가 신규 적용되었으므로 일단 전달...(단, 현재 캘릭더 조건(월, 주, 현재 시간)에 맞추어 노출)
                    }
                }else{
                    return {
                        message: 'noAuth',
                        success: false
                    }
                }
           } catch (error) {
                console.log(`/schedule/calendar error : ${error.message}`);
                return {
                    message: 'error',
                    success: false
                }
           }
        }
    },

    // AI 스케쥴러 작성 요청
    {
        url : '/requestAiSchdule', 
        type : 'post',
        callback : async ({request, params}) => {
            try {
                if(request.isAuthenticated()){
                    if(!params.prompt || params.prompt.replace(/\s+/g, '') == ""){
                        return {
                            message: 'noMessage',
                            success: false
                        }
                    }

                    const userId = request.user.userId; 

                    // 사용자 프로필 정보 조회
                    const userProfile = await sendQuery('select age, height, weight, gender from "USER" where user_id = $1', [userId]);

                    // env 에서 파이썬 모듈 경로
                    const pythonEnvPath = path.join(process.env.PYTHON_ENV_PATH, 'python');
                    // gpt 모델 파일 경로
                    const pyScriptPath = path.join(__dirname, 'gptModel.py');
                    // AI 요청 구분
                    const aiRequestDiv = "schedule";
                    // gpt 3.5 터보 모델명 가져옴
                    const model = process.env.GPT_4_o;

                    const gptResult = await new Promise((resolve, reject) => {
                        // child process 실행 (파라미터 : 모델 파일 경로, 질의 구분 코드, GPT 모델명, 질의(프롬프트), 추가 data: string 형태로 변환해서 전달)
                        // 사용할 모델 정보, 프롬프트를 전달
                        const child = spawn(pythonEnvPath, [pyScriptPath, aiRequestDiv, model, params.prompt, JSON.stringify(userProfile[0])]); 

                        // 결과 수신
                        let result = '';
                        child.stdout.on('data', (data) => {
                            result += data.toString();
                        });

                        // 에러 출력
                        child.stderr.on('data', (data) => {
                            console.error('/schedule/requestAiSchdule', data.toString());
                        });


                        child.on('close', async (code) => {
                            if (code !== 0) {
                                reject(`종료 코드 ${code}`);
                            }else{
                                try {
                                    const gptResult = JSON.parse(result);
                                    if(gptResult.success == 'true'){
                                        const scheduleList = gptResult.content; // 스케쥴 내용
                                        const deleteQuery = "delete from schedule where user_id = $1 and to_char(start_time, 'YYYY-MM-DD') >= to_char($2::timestamp, 'YYYY-MM-DD') and status <> 'D'";
                                        // 데이터 인서트 전 현재 + 미래데이터 제거(scheduleList[0] 의 starttime 보다 미래 starttime 데이터 제거)
                                        const deleteSchedule = await sendQuery(deleteQuery, [userId, scheduleList[0].startTime]);


                                        // 데이터 인서트
                                        let scheduleInsertQuery = "insert into schedule ( user_id, start_time, end_time, excersise_division, excersize_cnt ) values "
                                        let scheduleInsertItems = [];
                                        if(scheduleList.length > 0){
                                            scheduleList.forEach((schedule, idx) => {
                                                const { startTime, endTime, excersiseDivision, excersiseCnt } = schedule;
                                                scheduleInsertItems.push(`( '${userId}', '${startTime}',  '${endTime}', '${excersiseDivision}', ${excersiseCnt})`);
                                            })
                                            scheduleInsertQuery += scheduleInsertItems.join();
                                            await sendQuery(scheduleInsertQuery);
                                        }

                                    }
                                    resolve(true);
                                } catch (err) {
                                    reject(false);
                                }
                            }
                        });
                    });
                    

                    if(gptResult){ // 정상 동작 > 프론트로 정상 동작 여부 전달
                        return { 
                            message: 'success',
                            success: true
                        }
                    }else{ // 에러 발생 > 프론트로 에러 발생 전달
                        return { 
                            message: 'error',
                            success: false
                        }
                    }
                }else{ // 비인증 접근 > 프론트로 비인증 여부 전달
                    return {
                        message: 'noAuth',
                        success: false
                    }
                }
            } catch (error) {
                console.log(`/schedule/requestAiSchdule error : ${error.message}`);
                return {
                    message: 'error',
                    success: false
                }
            }

        }   
    },


    // 스케쥴 상태 전환
    {
        url : '/updateSchedule', 
        type : 'patch',
        callback : async ({request, params}) => {
            try {
                if(request.isAuthenticated()){
                    if(!params.scheduleId || !params.status){
                        return {
                            message: 'noParam',
                            success: false
                        }
                    }

                    const userId = request.user.userId;
                    const result = await sendQuery("update schedule set status = $3 where user_id = $1 and schedule_id = $2", [userId, params.scheduleId, params.status])
                    
                    return { 
                        message: 'success',
                        success: true
                    }
                }else{ // 비인증 접근 > 프론트로 비인증 여부 전달
                    return {
                        message: 'noAuth',
                        success: false
                    }
                }
            } catch (error) {
                console.log(`/schedule/requestAiSchdule error : ${error.message}`);
                return {
                    message: 'error',
                    success: false
                }
            }

        }   
    },




    // 
    
    // AI 식단 작성 요청
    {
        url : '/requestAiDiet', 
        type : 'post',
        callback : async ({request, params}) => {
            try {
                if(request.isAuthenticated()){
                    const userId = request.user.userId; 

                    if(!params.fileId){ // 파일 정보가 없는 경우 에러처리
                        return {
                            success:false,
                            message:'noFile'
                        }
                    }

                    const fileYn = await sendQuery('select file_id from file where file_id = $1', [params.fileId]);
                    if(!fileYn || fileYn.length == 0){ // 파일 정보가 없는 경우 에러처리
                        return {
                            success:false,
                            message:'noFile'
                        }
                    }

                    // env 에서 파이썬 모듈 경로
                    const pythonEnvPath = path.join(process.env.PYTHON_ENV_PATH, 'python');
                    // gpt 모델 파일 경로
                    const pyScriptPath = path.join(__dirname, 'gptModel.py');
                    // AI 요청 구분
                    const aiRequestDiv = "diet";
                    // gpt 4o 터보 모델명 가져옴
                    const model = process.env.GPT_4_o;

                    const gptResult = await new Promise((resolve, reject) => {
                        // child process 실행 (파라미터 : 모델 파일 경로, 질의 구분 코드, GPT 모델명, 질의(프롬프트), 추가 data: string 형태로 변환해서 전달)
                        // 사용할 모델 정보, 프롬프트를 전달
                        const child = spawn(pythonEnvPath, [pyScriptPath, aiRequestDiv, model, params.fileId, '']); 

                        // 결과 수신
                        let result = '';
                        child.stdout.on('data', (data) => {
                            result += data.toString();
                        });

                        // 에러 출력
                        child.stderr.on('data', (data) => {
                            console.error('/schedule/requestAiDiet', data.toString());
                        });

                        child.on('close', async (code) => {
                            if (code !== 0) {
                                reject(`종료 코드 ${code}`);
                            }else{
                                try {
                                    const gptResult = JSON.parse(result);
                                    if(gptResult.success == 'true'){
                                        const dietResult = JSON.parse(gptResult.content); // 스케쥴 내용

                                        if(!dietResult || dietResult.length == 0){
                                            return {
                                                success:false,
                                                message:'noDiet'
                                            }
                                        }

                                        // 메인디쉬 추출
                                        const dietTotalCal = dietResult.reduce((sum, item) => sum + item.totalCal, 0); // totalCal 전체 계산 sum : 축적 값, item : 루프 객체, 0 : 초기 값
                                        const mainDish = dietResult.filter(item => item.isMainDish)[0];
                                        const { name, category } = mainDish;
                                        
                                        
                                        const diet = await sendQuery(`
                                            insert into diet (
                                                user_id,
                                                diet_main_menu_name,
                                                category,
                                                total_calorie,
                                                file_id
                                            ) values (
                                                $1, $2, $3, $4, $5
                                            )
                                            returning diet_id
                                        `, [userId, name, category, dietTotalCal, params.fileId])

                                        const { dietId } = diet[0];


                                        let insertDietMenuIdQueryParamCnt = 0;
                                        let insertDietMenuIdQueryParam = [];
                                        let insertDietMenuIdQuery = `
                                            insert into DIET_MENU_ID (
                                                diet_id,
                                                user_id,
                                                diet_menu_name,
                                                calorie,
                                                is_main_dish,
                                                topping
                                            ) values 
                                        `;

                                        const insertDietMenuIdQueryValues = dietResult.reduce((query, item) => {
                                            const { name, topping, isMainDish, totalCal } = item;
                                            query += (
                                                `${query == '' ? '' : ','}( 
                                                    $${++insertDietMenuIdQueryParamCnt}, 
                                                    $${++insertDietMenuIdQueryParamCnt}, 
                                                    $${++insertDietMenuIdQueryParamCnt}, 
                                                    $${++insertDietMenuIdQueryParamCnt}, 
                                                    $${++insertDietMenuIdQueryParamCnt}, 
                                                    $${++insertDietMenuIdQueryParamCnt}
                                                )`
                                            )
                                            insertDietMenuIdQueryParam.push(Number(dietId))
                                            insertDietMenuIdQueryParam.push(Number(userId))
                                            insertDietMenuIdQueryParam.push(name)
                                            insertDietMenuIdQueryParam.push(Number(totalCal))
                                            insertDietMenuIdQueryParam.push(isMainDish ? 'Y' : 'N')
                                            insertDietMenuIdQueryParam.push(topping.join(', '))
                                            return query;
                                        }, '')

                                        await sendQuery(insertDietMenuIdQuery + insertDietMenuIdQueryValues, insertDietMenuIdQueryParam);

                                        resolve({
                                            success:true,
                                            message:"success",
                                            dietId:dietId
                                        });
                                    }else{
                                        reject({
                                            success:false
                                        });    
                                    }
                                } catch (err) {
                                    console.log(err);
                                    reject({
                                        success:false
                                    });
                                } 
                            }
                        });
                    });
                    

                    if(gptResult.success){ // 정상 동작 > 프론트로 정상 동작 여부 전달
                        return { 
                            message: 'success',
                            success: true,
                            content: gptResult.content
                        }
                    }else{ // 에러 발생 > 프론트로 에러 발생 전달
                        return { 
                            message: 'error',
                            success: false
                        }
                    }
                }else{ // 비인증 접근 > 프론트로 비인증 여부 전달
                    return {
                        message: 'noAuth',
                        success: false
                    }
                }
            } catch (error) {
                console.log(`/schedule/requestAiDiet error : ${error.message}`);
                console.log(error)
                return {
                    message: 'error',
                    success: false
                }
            }

        }   
    },
    
    // 사용자 일(day) 단위(운동 꾸준히 한 수준)의 필요 칼로리 소모량 조회
    {
        url : "/user/dayCalorie", 
        type : 'get',
        callback : async ({request, params}) => {
            try {
                if(request.isAuthenticated()){
                    const userId = request.user.userId; // 디폴트는 로그인한 사람 데이터 조회

                    const result = await sendQuery(`
                         select * from "USER"
                         where user_id = $1
                    `, [userId])

                    if(result.length == 0){
                        return { 
                            message: 'noUser',
                            success: true
                        }
                    }

                    
                    const { age, height, weight, gender } = result[0];

                    /*
                    ✅ 활동 지수(Activity Factor) 표
                    활동 수준	설명	활동 지수 (activityFactor)
                    1.2	거의 움직이지 않음 (앉아서 일함)	Sedentary
                    1.375	가벼운 운동 (주 1~3일)	Lightly Active
                    1.55	중간 정도 운동 (주 3~5일)	Moderately Active
                    1.725 ← [기본값]	격렬한 운동 (주 6~7일)	Very Active
                    1.9	매우 격렬한 운동 (하루 2회 이상)	Super Active
                    */
                    const activityFactors = {
                        sedentary: 1.2,
                        light: 1.375,
                        moderate: 1.55,
                        active: 1.725,
                        veryActive: 1.9,
                      };
                    
                      // 1. BMR 계산
                      const bmr = (
                        gender === 'M' ? (10 * weight + 6.25 * height - 5 * age + 5) : (10 * weight + 6.25 * height - 5 * age - 161)
                    );
                    
                    // 2. 활동지수 반영
                    const activityFactor = activityFactors['active'] || 1.725;
                    const tdee = bmr * activityFactor;


                    return { 
                        message: 'success',
                        success: true,
                        data : {
                            tdee: Math.round(tdee), // 소모가 필요한 칼로리량
                            targetCalories : Math.round(tdee - 300) // 섭취가 필요한 칼로리량(감량)
                        }
                    }
                }else{ // 비인증 접근 > 프론트로 비인증 여부 전달
                    return {
                        message: 'noAuth',
                        success: false
                    }
                }
            } catch (error) {
                console.log(`/schedule/requestAiSchdule error : ${error.message}`);
                return {
                    message: 'error',
                    success: false
                }
            }

        }   
    },


];

const selectCalendaSchedule = async (wheres, whereParams, userId) => {
    let selectScheduleQuery = `
            select
                schedule_id,
                (
                    case 
                        when s.status = 'D' then s.diet_main_menu_name
                        else c_ex.code_name end
                ) as title,
                s.start_time as start,
                s.end_time as end,
                c_s.description as background_color,
                '#fff' as color,
                s.status,
                s.excersize_cnt,
                split_part(c_ex.description, '|', 1) as cal,
                split_part(c_ex.description, '|', 2) as unit,
                s.total_calorie,
                s.menus,
                s.file_id
            from (
                (
                    select 
                        schedule_id,
                        status,
                        start_time,
                        end_time,
                        excersize_cnt,
                        excersise_division,
                        0 as total_calorie,
                        '' as diet_main_menu_name,
                        '' as menus,
                        '0' as file_id
                    from schedule
                    where user_id = $1
                )

                union all

                (
                    select 
                        d.diet_id as schedule_id,
                        'D' as status,
                        d.regist_date as start_time,
                        (
                            case 
                                when d.regist_date + interval '1 hour' >= d.regist_date::date + interval '1 day' then
                                (d.regist_date::date + interval '1 day') - interval '1 second'
                                else d.regist_date + interval '1 hour'
                            end
                        ),
                        1 as excersize_cnt,
                        '' as excersise_division,
                        d.total_calorie,
                        d.diet_main_menu_name,
                        m.menus,
                        d.file_id
                    from diet d 
                    join (
                        select
                            diet_id,
                            string_agg(concat(diet_menu_name, '(칼로리 :', calorie,')'), '|') as menus
                        from diet_menu_id
                        group by diet_id
                    ) m
                    on d.diet_id = m.diet_id
                    where d.user_id = $2
                )
            ) s
            left outer join (
                select *
                from code_detail
                where code_class = 'C001'
            ) c_ex
            on s.excersise_division = c_ex.code_id
            left outer join (
                select * 
                from code_detail
                where code_class = 'C002'
            ) c_s
            on s.status = c_s.code_id
    `;

    let totalParam = [userId, userId];
    if(wheres && wheres.length > 0){ // wheres가 존재하며, 길이가 1이상 일때 조건이 있다고 판단
        selectScheduleQuery += "where"
        let whereCnt = 3;
        wheres.forEach((where, idx) => {
            // 조건절( ex1] " and user_id = " ex2] "or start_time >= ") 분리를 위해 앞에 공백 처리 + 파라미터 전달을 위한 ${1} 작성
            if(where.indexOf(' in') == -1){ // in 조건절 제외
                selectScheduleQuery += ` ${where} $${(whereCnt)}`;
                totalParam.push(whereParams[idx]); // 파라미터 전달을 위해 담아줌
                whereCnt ++;
            }else{

                if(idx <= whereParams.length - 1){
                    if(!(whereParams[idx] == undefined || whereParams[idx] == "" || whereParams[idx].length == 0)){
                        selectScheduleQuery += ` ${where} (`;
                        let inParams = [];
                        if(typeof whereParams[idx] == "string"){
                            inParams = whereParams[idx].split(",");
                        }else{
                            inParams = whereParams[idx];
                        }
    
                        inParams.forEach((item, idx) => {
                            selectScheduleQuery += (`${idx == 0 ? '' : ','} $${whereCnt}`);
                            whereCnt ++;
                            totalParam.push(item); // 파라미터 전달을 위해 담아줌
                        })
    
    
                        selectScheduleQuery += ` )`;
                    }
                }
            }


        })
    }

    // order by 추가
    selectScheduleQuery += ` order by start`

    if(whereParams && whereParams.length > 0){
        return await sendQuery(selectScheduleQuery, totalParam);
    }else{
        return await sendQuery(selectScheduleQuery, totalParam);
    }
}


//  3) 통신 객체 배열 Route 등록
schedulerControllers.forEach(route => {
    initRoute(router, route);
});

module.exports = router;