
// * Controllers 기본 구조
//  1) router 및 initRoute repuire
const router = require('express').Router(); // express의 Router 객체 생성(모듈 로드)
const { initRoute } = require('../../routes/common_routes'); // 라우트 작성
const { sendQuery } = require('../../config/database');
const ROLE = require('../../config/ROLE');

//  2) 통신 객체 배열 선언
const productControllers = [
    {
        url : '/changeIsDeleted', 
        type : 'patch',
        callback : async ({request, params}) => {
           try {
               if(request.isAuthenticated()){ // 트레이너만 조회 가능
                    const role = request.user.role;
                    if(role != ROLE.TRAINER){
                        return {
                            message: 'noAuth',
                            success: false
                        }
                    }
                    const userId = request.user.userId; // 디폴트는 로그인한 사람 데이터 조회
                    const result = await sendQuery(`
                        update products
                        set is_deleted = $3
                        where user_id = $1 
                        and product_id = $2   
                    `, [userId, params.productId, params.isDeleted])
                    
                    return { 
                        message: 'success',
                        success: true,
                    }
                }else{
                    return {
                        message: 'noAuth',
                        success: false
                    }
                }
           } catch (error) {
                console.log(`/buy/matchMember error : ${error.message}`);
                return {
                    message: 'error',
                    success: false
                }
           }
        }
    },
    {
        url : '/reg', 
        type : 'post',
        callback : async ({request, params}) => {
           try {
               if(request.isAuthenticated()){ // 트레이너만 조회 가능
                    const role = request.user.role;
                    if(role != ROLE.TRAINER){
                        return {
                            message: 'noAuth',
                            success: false
                        }
                    }

                    const userId = request.user.userId; // 디폴트는 로그인한 사람 데이터 조회
                    const { productId, name, description, price, sessionCnt } = params;

                    let insertQueryParam = [name, description, price, sessionCnt, userId];
                    if(productId > 0){
                        insertQueryParam.push(productId)
                    }

                    const result = await sendQuery(`
                        insert into products (
                            name, description, price, session_cnt, user_id, is_deleted, type
                            ${(productId > 0 ? ', product_id' : '')}
                        ) values (
                            $1, $2, $3, $4, $5, false, 'C'${(productId > 0 ? ', $6' : '')}
                        )
                        on conflict (product_id) 
                        do update set 
                            name = excluded.name,
                            description = excluded.description,
                            price = excluded.price,
                            session_cnt = excluded.session_cnt
                    `, insertQueryParam)
                    

                    let product;
                    if(productId > 0){
                        product = await sendQuery(`
                            select *
                            from products
                            where product_id = $1 
                        `, [productId]);
    
                        const productUserList = await sendQuery(
                            `
                            select 
                                b.*, 
                                u.user_name, 
                                u.nick_name, 
                                u.phone_number, 
                                u.email,
                                u.age, 
                                u.height, 
                                u.weight, 
                                u.gender, 
                                u.fit_history,
                                u.fit_goal,
                                c.code_name as status_name
                            from buy b
                            join "USER" u 
                            on b.user_id = u.user_id
                            join (
                                select * 
                                from code_detail 
                                where code_class = 'C003'
                            ) c
                            on b.status = c.code_id
                            where b.product_id = $1 
                            `,
                        [productId]);
    
                        product[0].buyUserList = productUserList;
                    }

                    return { 
                        message: 'success',
                        success: true,
                        data:(product == undefined ? {} : product[0])
                    }
                }else{
                    return {
                        message: 'noAuth',
                        success: false,
                        data:product
                    }
                }
           } catch (error) {
                console.log(`/buy/matchMember error : ${error.message}`);
                return {
                    message: 'error',
                    success: false
                }
           }
        }
    }
]


//  3) 통신 객체 배열 Route 등록
productControllers.forEach(route => {
    initRoute(router, route);
});

module.exports = router;