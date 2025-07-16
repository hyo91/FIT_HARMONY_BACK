const passport = require('passport'); // 인증 미들웨어


// * Controllers 기본 구조
//  1) router 및 initRoute repuire
const router = require('express').Router(); // express의 Router 객체 생성(모듈 로드)
const { initRoute } = require('../routes/common_routes'); // 라우트 작성
//  2) 통신 객체 배열 선언
const authControllers = [
    // 1. 로그인 기능
    {
        url : '/auth/login', 
        type : 'post',
        auth : passport.authenticate('local'),
        callback : async ({request, params}) => {
            try {
                // 로그인 동작 테스트 필요
                // params 에서 받아지는지, request에서 받아지는지 확인 필요
                console.log(request.user);
                console.log(params.user);
                return { 
                    message: 'Login Success...',
                    success: true,
                    user: request.user 
                }
            } catch (error) {
                console.log(`/login error : ${error.message}`);
                return {
                    message: 'Login Error...'
                };
            }

        }   
    },

    // 2. 로그아웃 기능
    {
        url : '/auth/logout', 
        type : 'post',
        auth : passport.authenticate('local'),
        callback : async ({request}) => {
            try {
                // 테스트 필요
                request.logout();
                return {
                    message: 'Logout Success...',
                    success: true
                }
            } catch (error) {
                console.log(`authControllers /login error : ${error.message}`);
                return {
                    message: 'Login Error...'
                };
            }

        }   
    },
];
//  3) 통신 객체 배열 Route 등록
authControllers.forEach(route => {
    initRoute(router, route);
});

module.exports = router;