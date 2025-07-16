const { sendQuery } = require('../../config/database');
const { spawn } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();
const getUserInbodyDayData = async (req, res) => {
    try {
        const { userId } = req.params;
        const { inbodyTime } = req.query;
        // 최근 인바디 데이터 조회
        const inbodyQuery = `
            SELECT 
                INBODY_ID,
                WEIGHT,
                BODY_WATER,
                INBODY_SCORE,
                PROTEIN,
                BODY_MINERAL,
                BODY_FAT,
                BODY_FAT_PERCENT,
                BMI,
                SKELETAL_MUSCLE,
                TRUNK_MUSCLE,
                LEFT_ARM_MUSCLE,
                RIGHT_ARM_MUSCLE,
                LEFT_LEG_MUSCLE,
                RIGHT_LEG_MUSCLE,
                TRUNK_FAT,
                LEFT_ARM_FAT,
                RIGHT_ARM_FAT,
                LEFT_LEG_FAT,
                RIGHT_LEG_FAT,
                INBODY_TIME
            FROM inbody i
            WHERE i.user_id = $1
            AND (CAST($2 AS date) = '1000-01-01' OR i.inbody_time = CAST($2 AS date))
            ORDER BY INBODY_TIME DESC
            LIMIT 1
        `;
      
        const inbodyStandardQuery = `
            SELECT i.item_name, i.min_value, i.max_value
            FROM inbody_standard i
            JOIN "USER" u ON
	            u.age BETWEEN 
                    CAST(split_part(i.age_group, '_', 1) AS INTEGER)
                    AND
                    CAST(split_part(i.age_group, '_', 2) AS INTEGER)
	            AND
                u.gender = i.gender
            WHERE u.user_id = $1
        `;
        
        const inbodyTimeQuery = `
            SELECT DISTINCT inbody_time
            FROM inbody
            WHERE user_id = $1
            ORDER BY inbody_time ASC
        `;

        const inbodyResult = await sendQuery(inbodyQuery, [userId, inbodyTime]);
        const inbodyStandardResult = await sendQuery(inbodyStandardQuery, [userId]);
        const inbodyTimeResult = await sendQuery(inbodyTimeQuery, [userId]);
        
        // inbodyResult가 비어있어도 200 상태로 응답
        res.status(200).json({
            success: true,
            credentials: 'include',
            inbodyResult: inbodyResult || [],
            standardData: inbodyStandardResult || [],
            inbodyTimeResult: inbodyTimeResult || [],
            message: inbodyResult && inbodyResult.length > 0 ? '사용자 Inbody 데이터 조회 성공' : '해당 사용자의 Inbody 데이터가 없습니다'
        });
    } catch (error) {
        console.error('사용자 Inbody 데이터 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다'
        });
    }
};

const getUserInbodyMonthData = async (req, res) => {
    try {
        const { userId } = req.params;
        const { startDate, endDate } = req.query;
        const inbodyTimeQuery = `
            SELECT TO_CHAR(inbody_time, 'YYYY-MM-dd') as inbody_time
            FROM inbody
            WHERE user_id = $1
            AND inbody_time >= TO_DATE($2, 'YYYY-MM-dd')
  			AND inbody_time < TO_DATE($3, 'YYYY-MM-dd')
            ORDER BY INBODY_TIME DESC
        `;
        //  = $2 나중에 추가
        const inbodyTimeResult = await sendQuery(inbodyTimeQuery, [userId,startDate, endDate]);
        
        if (inbodyTimeResult && inbodyTimeResult.length > 0) {
            res.status(200).json({
                inbodyTimeResult: inbodyTimeResult
            });
        } else {
            res.status(400).json({
                success: false,
                message: '해당 사용자의 Inbody 데이터가 없습니다'
            });
        }
    } catch (error) {
        console.error('사용자 Inbody 데이터 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다'
        });
    }
};

// 인바디 데이터 등록
const insertInbodyData = async (req, res) => {
    try {
        const { userId } = req.params;
        const {
            weight,
            bodyWater,
            inbodyScore,
            protein,
            bodyMineral,
            bodyFat,
            bodyFatPercent,
            bmi,
            skeletalMuscle,
            trunkMuscle,
            leftArmMuscle,
            rightArmMuscle,
            leftLegMuscle,
            rightLegMuscle,
            trunkFat,
            leftArmFat,
            rightArmFat,
            leftLegFat,
            rightLegFat,
            inbodyTime
        } = req.body;

        const insertQuery = `
            INSERT INTO inbody (
                user_id,
                weight,
                body_water,
                inbody_score,
                protein,
                body_mineral,
                body_fat,
                body_fat_percent,
                bmi,
                skeletal_muscle,
                trunk_muscle,
                left_arm_muscle,
                right_arm_muscle,
                left_leg_muscle,
                right_leg_muscle,
                trunk_fat,
                left_arm_fat,
                right_arm_fat,
                left_leg_fat,
                right_leg_fat,
                inbody_time
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
            ) RETURNING inbody_id
        `;

        // 사용자 몸무게 수정
        const updateUserQuery = `
        UPDATE "USER" u
        SET weight = $1
        WHERE u.user_id = $2
        RETURNING u.user_id
        `;

        const values = [
            userId,
            weight,
            bodyWater,
            inbodyScore,
            protein,
            bodyMineral,
            bodyFat,
            bodyFatPercent,
            bmi,
            skeletalMuscle,
            trunkMuscle,
            leftArmMuscle,
            rightArmMuscle,
            leftLegMuscle,
            rightLegMuscle,
            trunkFat,
            leftArmFat,
            rightArmFat,
            leftLegFat,
            rightLegFat,
            inbodyTime
        ];

        const userValues = [weight, userId];
        const result = await sendQuery(insertQuery, values);
        const userResult = await sendQuery(updateUserQuery, userValues);

        if (result && result.length > 0 && userResult && userResult.length > 0) {
            res.status(201).json({
                success: true,
                message: '인바디 데이터가 성공적으로 등록되었습니다',
            });
        } else {
            res.status(500).json({
                success: false,
                message: '데이터 등록에 실패했습니다'
            });
        }
    } catch (error) {
        console.error('인바디 데이터 등록 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다'
        });
    }
};

// 인바디 데이터 수정
const updateInbodyData = async (req, res) => {
    try {
        const {
            inbodyId,
            weight,
            bodyWater,
            inbodyScore,
            protein,
            bodyMineral,
            bodyFat,
            bodyFatPercent,
            bmi,
            skeletalMuscle,
            trunkMuscle,
            leftArmMuscle,
            rightArmMuscle,
            leftLegMuscle,
            rightLegMuscle,
            trunkFat,
            leftArmFat,
            rightArmFat,
            leftLegFat,
            rightLegFat,
            inbodyTime
        } = req.body;

        const updateInbodyQuery = `
            UPDATE inbody SET (
                weight,
                body_water,
                inbody_score,
                protein,
                body_mineral,
                body_fat,
                body_fat_percent,
                bmi,
                skeletal_muscle,
                trunk_muscle,
                left_arm_muscle,
                right_arm_muscle,
                left_leg_muscle,
                right_leg_muscle,
                trunk_fat,
                left_arm_fat,
                right_arm_fat,
                left_leg_fat,
                right_leg_fat,
                inbody_time
            ) = (
                $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
            ) WHERE inbody_id = $1
            RETURNING inbody_id
        `;

        // 사용자 몸무게 수정
        const updateUserQuery = `
        UPDATE "USER" u
        SET weight = (
            SELECT weight
            FROM INBODY i
            WHERE i.user_id = u.user_id
        	AND i.inbody_id = $1
        	ORDER BY inbody_time desc
        	LIMIT 1
            ) RETURNING u.user_id`;

        const inbodyValues = [
            inbodyId,
            weight,
            bodyWater,
            inbodyScore,
            protein,
            bodyMineral,
            bodyFat,
            bodyFatPercent,
            bmi,
            skeletalMuscle,
            trunkMuscle,
            leftArmMuscle,
            rightArmMuscle,
            leftLegMuscle,
            rightLegMuscle,
            trunkFat,
            leftArmFat,
            rightArmFat,
            leftLegFat,
            rightLegFat,
            inbodyTime
        ];

        const userValues = [inbodyId];

        const result = await sendQuery(updateInbodyQuery, inbodyValues);
        const userResult = await sendQuery(updateUserQuery, userValues);

        if (result && result.length > 0 && userResult && userResult.length > 0) {
            res.status(201).json({
                success: true,
                message: '인바디 데이터가 성공적으로 수정되었습니다',
            });
        } else {
            res.status(500).json({
                success: false,
                message: '데이터 수정에 실패했습니다'
            });
        }
    } catch (error) {
        console.error('인바디 데이터 수정 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다'
        });
    }
};

// 인바디 분석 요청
const requestInbodyOcr = async (req, res) => {
    try {
        const { fileId } = req.body;
        
        if (!fileId) {
            return res.status(400).json({
                success: false,
                message: '파일 ID가 필요합니다.'
            });
        }
        // 파일 존재 여부 확인
        const fileCheck = await sendQuery('select file_id from file where file_id = $1', [fileId]);
        if (!fileCheck || fileCheck.length == 0) {
            return res.status(400).json({
                success: false,
                message: '파일을 찾을 수 없습니다.'
            });
        }

        // Python 스크립트 실행
        const pythonEnvPath = path.join(process.env.PYTHON_ENV_PATH, 'python');
        const pyScriptPath = path.join(__dirname, 'inbodyGptModel.py');
        const aiRequestDiv = "inbody_gpt";
        // const pyScriptPath = path.join(__dirname, 'inbodyOcrModel.py');
        // const aiRequestDiv = "inbody_ocr";
        const model = process.env.GPT_4_o; // 모델명 추가
       

        const ocrResult = await new Promise((resolve, reject) => {
            const child = spawn(pythonEnvPath, [pyScriptPath, aiRequestDiv, fileId, model], {
                env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
            });

            let result = '';
            child.stdout.on('data', (data) => {
                console.log('PYTHON STDOUT:', data.toString());
                result += data.toString();
            });

            child.stderr.on('data', (data) => {
                console.error('/inbody/requestOcr', data.toString());
            });

            child.on('close', async (code) => {
                if (code !== 0) {
                    reject(`종료 코드 ${code}`);
                } else {
                    try {
                        console.log("result", result);
                        const parsedResult = JSON.parse(result);
                        if (parsedResult.success === 'true') {
                            resolve(parsedResult.content);
                        } else {
                            reject(parsedResult.message || '인바디 분석 실패');
                        }
                    } catch (err) {
                        reject('결과 파싱 실패');
                    }
                }
            });
        });

        res.status(200).json({
            success: true,
            message: '인바디 분석이 완료되었습니다.',
            data: ocrResult.analyzed_data
        });

    } catch (error) {
        console.error('인바디 분석 오류:', error);
        res.status(500).json({
            success: false,
            message: '인바디 분석 중 오류가 발생했습니다.'
        });
    }
};

// 인바디 데이터 삭제
const deleteInbodyData = async (req, res) => {
    try {
        const { inbodyId } = req.params;
        
        if (!inbodyId) {
            return res.status(400).json({
                success: false,
                message: '인바디 ID가 필요합니다.'
            });
        }

        // 인바디 데이터 존재 여부 확인
        const checkQuery = `
            SELECT inbody_id, user_id, weight, inbody_time
            FROM inbody
            WHERE inbody_id = $1
        `;
        
        const checkResult = await sendQuery(checkQuery, [inbodyId]);
        
        if (!checkResult || checkResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: '삭제할 인바디 데이터를 찾을 수 없습니다.'
            });
        }

        const inbodyData = checkResult[0];
        const userId = inbodyData.user_id;

        // 인바디 데이터 삭제
        const deleteQuery = `
            DELETE FROM inbody
            WHERE inbody_id = $1
            RETURNING inbody_id
        `;

        const deleteResult = await sendQuery(deleteQuery, [inbodyId]);

        if (deleteResult && deleteResult.length > 0) {
            // 사용자 몸무게를 가장 최근 인바디 데이터로 업데이트
            const updateUserWeightQuery = `
                UPDATE "USER" u
                SET weight = (
                    SELECT weight
                    FROM inbody i
                    WHERE i.user_id = $1
                    ORDER BY inbody_time DESC
                    LIMIT 1
                )
                WHERE u.user_id = $1
                RETURNING u.user_id
            `;

            await sendQuery(updateUserWeightQuery, [userId]);

            res.status(200).json({
                success: true,
                message: '인바디 데이터가 성공적으로 삭제되었습니다.'
            });
        } else {
            res.status(500).json({
                success: false,
                message: '인바디 데이터 삭제에 실패했습니다.'
            });
        }
    } catch (error) {
        console.error('인바디 데이터 삭제 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.'
        });
    }
};

module.exports = {
    getUserInbodyDayData,
    getUserInbodyMonthData,
    insertInbodyData,
    updateInbodyData,
    deleteInbodyData,
    requestInbodyOcr
}; 