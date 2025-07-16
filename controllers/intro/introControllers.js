// * Controllers 기본 구조
//  1) router 및 initRoute repuire
const router = require('express').Router(); // express의 Router 객체 생성(모듈 로드)
const { initRoute } = require('../../routes/common_routes'); // 라우트 작성
const { sendQuery } = require('../../config/database');

//  2) 통신 객체 배열 선언
const introControllers = [
    // 
    {
        url : '/',
        type : 'get',
        callback : async ({request, params}) => {
            try {

                const data = {
                    diet: [],
                    communityLatest: [],
                    communityHot: [],
                    trainer: [],
                }
                const introDietQuery = `SELECT diet_main_menu_name, 
                                               COUNT(*) AS diet_count,
                                              (SELECT file_id
                                               FROM diet AS d2 
                                               WHERE d2.diet_main_menu_name = d1.diet_main_menu_name
                                               LIMIT 1) AS file_id
                                        FROM diet AS d1
                                        GROUP BY diet_main_menu_name
                                        ORDER BY diet_count DESC
                                        LIMIT 10
                                        `

                const introCommunityLatestQuery = ` SELECT post_id, 
                                                           title,
                                                          (SELECT COUNT(*)
                                                           FROM comment c 
                                                    WHERE p.post_id = c.post_id) AS comment_count 
                                                    FROM post p 
                                                    ORDER BY created_time DESC 
                                                    LIMIT 5
                                                    `
                const introCommunityHotQuery = `SELECT post_id, 
                                                       title,
                                                      (SELECT COUNT(*)
                                                       FROM comment c 
                                                       WHERE p.post_id = c.post_id) AS comment_count
                                                FROM post p
                                                ORDER BY comment_count DESC 
                                                LIMIT 5
                                                `
                const introTrainerQuery =  `SELECT u.user_id, 
                                                   u.file_id, 
                                                   u.nick_name, 
                                                   u.fit_goal, 
                                                   COUNT(p.product_id) AS product_count
                                            FROM "USER" u
                                            LEFT JOIN PRODUCTS p ON u.user_id = p.user_id
                                            WHERE u.role = 'TRAINER'
                                            AND u.status = 'ACTIVE'
                                            GROUP BY u.user_id, u.file_id, u.nick_name, u.fit_goal
                                            ORDER BY product_count DESC
                                            LIMIT 10
                                            `

                data.diet = await sendQuery(introDietQuery)
                data.communityLatest = await sendQuery(introCommunityLatestQuery)
                data.communityHot = await sendQuery(introCommunityHotQuery)
                data.trainer = await sendQuery(introTrainerQuery)

                    return { 
                        message: 'success',
                        success: true,
                        data: data || []
                    }
            } catch (error) {
                console.log(`/intro error : ${error.message}`);
                return {
                    message: 'error',
                    success: false
                }
            }
        }
    },
];

//  3) 통신 객체 배열 Route 등록
introControllers.forEach(route => {
    initRoute(router, route);
});

module.exports = router; 