const { sendQuery } = require('../../config/database');
const getTrainerList = async (req, res) => {
  try {
    const trainerlistquery = `
     SELECT COUNT(*) AS total
      FROM "USER"
      WHERE role = 'TRAINER'
    
    `;

    const trainerquery = `
      SELECT
        u.user_id,
        u.user_name,
        u.gender,
        (case when u.file_id is null then 1 else u.file_id end) as file_id,
         
        g.gym,
        g.gym_address,
        MIN(p.price) AS min_price,
        ROUND(AVG(r.rating), 2) AS rating,
        COUNT(r.review_id) AS review_count
      FROM "USER" u

      LEFT OUTER JOIN products p 
      ON u.user_id = p.user_id

      LEFT OUTER JOIN gym g 
      ON u.gym_id = g.gym_id

      LEFT OUTER JOIN review r 
      ON p.product_id = r.product_id

      WHERE u.role = 'TRAINER' and u.status = 'ACTIVE'

      GROUP BY u.user_id, u.user_name, u.gender, g.gym, g.gym_address, u.file_id
      `;

    const trainerresult = await sendQuery(trainerquery);
    const trainerlistresult = await sendQuery(trainerlistquery);

    res.status(200).json({
      success: true,
      data: trainerresult,
      total: trainerlistresult,

      message: '트레이너 목록 조회 성공',
    });
  } catch (error) {
    console.error('트레이너 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다',
    });
  }
};

const getTrainerDetail = async (req, res) => {
  const userId = req.params.id;

  const trainerDetailQuery = `
        SELECT
      u.user_id,
      u.user_name,
      u.introduction,
      u.fit_history,  
      u.file_id,
      g.gym,
      g.gym_address,
	  
      ROUND(AVG(r.rating), 2) AS rating,
      COUNT(r.review_id) AS review_count
    FROM "USER" u
    LEFT OUTER JOIN gym g ON u.gym_id = g.gym_id
    LEFT OUTER JOIN products p ON u.user_id = p.user_id
    LEFT OUTER JOIN review r ON p.product_id = r.product_id
    WHERE u.user_id = $1

    GROUP BY u.user_id, u.user_name, u.fit_history, u.file_id, g.gym, g.gym_address`;
  try {
    const result = await sendQuery(trainerDetailQuery, [userId]); //★★★★★★
    res.status(200).json({
      success: true,
      data: result[0],
      message: '트레이너 상세 조회 성공',
    });
  } catch (error) {
    console.error('트레이너 상세 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다',
    });
  }
};

const getTrainerProduct = async (req, res) => {
  const userId = req.params.id;

  const trainerProductQuery = `

      select
      u.user_id,
      p.product_id,
      p.name,
      p.description, p.price,
      p.type,
      p.session_cnt

    FROM "USER" u
    LEFT OUTER JOIN products p ON u.user_id = p.user_id
    WHERE u.user_id = $1 AND p.is_deleted = false
   `;

  try {
    const productresult = await sendQuery(trainerProductQuery, [userId]);
    res.status(200).json({
      success: true,
      data: productresult,
      message: '트레이너 상세 조회 성공',
    });
  } catch (error) {
    console.error('트레이너 상세 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다',
    });
  }
};

const getTrainerReview = async (req, res) => {
  const userId = req.params.id;

  const trainerReviewQuery = `
    SELECT
      r.review_id,
      r.user_id,
      u.user_name,
      r.rating,
      r.content,
      TO_CHAR(r.updated_time, 'YYYY-MM-DD') AS formatted_date
    FROM review r
    LEFT OUTER JOIN "USER" u ON r.user_id = u.user_id
    WHERE r.product_id IN (
      SELECT product_id FROM products
      WHERE user_id = $1 AND is_deleted = false
    )
    AND r.is_deleted = false
    ORDER BY RANDOM()
    LIMIT 3;
    

  `;
  try {
    const reviewResult = await sendQuery(trainerReviewQuery, [userId]);
    res.status(200).json({
      success: true,
      data: reviewResult,
      message: '트레이너 리뷰 조회 성공',
    });
  } catch (error) {
    console.error('트레이너 리뷰 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다',
    });
  }
};

// 리뷰 저장 (수정된 버전)
const createTrainerReview = async (req, res) => {
  if (req.isAuthenticated() == false) {
    return res.json({ msg: '회원이 아닙니다.', success: false });
  }

  try {
    const { trainerId, rating, content } = req.body;
    const { user } = req;
    const { userId } = user;

    // trainerId 검증 및 변환
    if (!trainerId || isNaN(trainerId)) {
      return res.json({
        msg: 'trainerId가 유효하지 않습니다.',
        success: false,
      });
    }

    const trainerIdNum = Number(trainerId);

    // 해당 트레이너의 상품 조회
    const getProductQuery = `
      SELECT product_id, name
      FROM products 
      WHERE user_id = $1 AND is_deleted = false
      ORDER BY product_id
      LIMIT 1
    `;

    const productResult = await sendQuery(getProductQuery, [trainerIdNum]);

    if (!productResult || productResult.length === 0) {
      return res.json({
        msg: '해당 트레이너의 상품을 찾을 수 없습니다.',
        success: false,
        debug: { trainerId, trainerIdNum },
      });
    }

    // productId로 접근 (camelCase)
    const productId = productResult[0]?.productId; // product_id → productId로 변경

    if (!productId) {
      return res.json({
        msg: 'product_id를 가져올 수 없습니다.',
        success: false,
        debug: { productResult },
      });
    }

    // 리뷰 저장
    const insertReviewQuery = `
      INSERT INTO review (user_id, product_id, rating, content, is_deleted, created_time, updated_time)
      VALUES ($1, $2, $3, $4, false, NOW(), NOW())
      RETURNING review_id
    `;

    const reviewResult = await sendQuery(insertReviewQuery, [
      userId,
      productId,
      rating,
      content,
    ]);

    res.json({
      msg: '리뷰가 성공적으로 등록되었습니다.',
      reviewId: reviewResult[0].review_id,
      success: true,
    });
  } catch (error) {
    console.error('리뷰 등록 오류:', error);
    res.json({
      msg: `리뷰 등록 실패: ${error.message}`,
      success: false,
    });
  }
};

// 리뷰 전체보기
const getAllTrainerReviews = async (req, res) => {
  const trainerId = req.params.id;

  const allReviewsQuery = `
    SELECT
      r.review_id,
      r.user_id,
      u.user_name,
      r.rating,
      r.content,
      TO_CHAR(r.created_time, 'YYYY-MM-DD') AS formatted_date,
      p.name AS product_name
    FROM review r
    LEFT OUTER JOIN "USER" u ON r.user_id = u.user_id
    LEFT OUTER JOIN products p ON r.product_id = p.product_id
    WHERE p.user_id = $1 
    AND r.is_deleted = false 
    AND p.is_deleted = false
    ORDER BY r.created_time DESC
  `;

  try {
    const allReviewsResult = await sendQuery(allReviewsQuery, [trainerId]);
    res.status(200).json({
      success: true,
      data: allReviewsResult,
      message: '트레이너 전체 리뷰 조회 성공',
    });
  } catch (error) {
    console.error('트레이너 전체 리뷰 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다',
    });
  }
};

module.exports = {
  getTrainerList,
  getTrainerDetail,
  getTrainerProduct,
  getTrainerReview, // 상세페이지용 리뷰 랜덤 3개
  getAllTrainerReviews, //리뷰 전체보기용
  createTrainerReview,
};
