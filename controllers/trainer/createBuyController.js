const { sendQuery } = require('../../config/database');

const createTrainerBuy = async (req, res) => {
  // 사용자 인증 확인
  if (req.isAuthenticated() == false) {
    return res.json({ msg: '회원이 아닙니다.', success: false });
  }

  try {
    //프론트 정보 받아옴
    const { productId } = req.body;
    const { user } = req;

    const { userId } = user;

    //상품 정보 조회
    const productInfoQuery = `
    SELECT price, session_cnt
    FROM products 
    WHERE product_id = $1
    `;
    const productInfoResult = await sendQuery(productInfoQuery, [productId]);

    const totalPrice = productInfoResult[0].price;
    const sessionLeft = productInfoResult[0].session_cnt;

    // 데이터 베이스에 저장
    const insertBuyQuery = `
      INSERT INTO buy (user_id, product_id, total_price, session_left )
    VALUES ($1, $2, $3, $4 )
    RETURNING buy_id
`;

    try {
      const buyResult = await sendQuery(insertBuyQuery, [
        userId,
        productId,
        totalPrice,
        sessionLeft,
      ]);

      res.json({
        msg: '상품 구매 완료',
        buyId: buyResult[0].buy_id,
        success: true,
      });
    } catch (error) {
      console.error('저장 실패:', error.message);
      console.error('쿼리:', insertBuyQuery);
      console.error('매개변수:', [userId, productId, totalPrice, sessionLeft]);
      res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다',
      });
    }
  } catch (error) {
    console.error('상품 구매 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다',
    });
  }
};

// 사용자가 구매한 상품 상태 조회
const getUserPurchasedProducts = async (req, res) => {
  // 사용자 인증 확인
  if (req.isAuthenticated() == false) {
    return res.json({ msg: '회원이 아닙니다.', success: false });
  }

  try {
    const { user } = req;
    const { userId } = user;

    // 사용자가 구매한 상품들과 상태 조회
    const getUserProductsQuery = `
      SELECT 
        u.user_id,
        b.buy_id,
        b.status,
        p.name as product_name,
        p.description,
        b.total_price
      FROM "USER" u
      LEFT OUTER JOIN buy b ON u.user_id = b.user_id
      LEFT OUTER JOIN products p ON b.product_id = p.product_id
      WHERE u.user_id = $1
    `;

    const result = await sendQuery(getUserProductsQuery, [userId]);

    // 구매한 상품이 없는 경우
    if (!result || result.length === 0) {
      return res.json({
        success: true,
        appliedServices: [],
        message: '구매한 상품이 없습니다.',
      });
    }

    // 구매한 상품들을 프론트엔드 형식에 맞게 변환
    const appliedServices = result
      .filter((item) => item.buyId !== null)
      .map((item) => {
        // 상태 값 매핑
        let mappedStatus = 'PENDING';
        if (item.status) {
          const status = item.status.toString().toUpperCase();
          switch (status) {
            case 'APPROVED':
            case 'A':
            case '승인':
              mappedStatus = 'APPROVED';
              break;
            case 'REJECTED':
            case 'R':
            case 'C':
            case '거절':
            case '취소':
              mappedStatus = 'REJECTED';
              break;
            case 'PENDING':
            case 'P':
            case '대기':
            default:
              mappedStatus = 'PENDING';
              break;
          }
        }

        return {
          buyId: item.buyId,
          productName: item.productName || '서비스',
          description: item.description || '',
          totalPrice: item.totalPrice,
          status: mappedStatus,
          rejectionReason:
            mappedStatus === 'REJECTED' ? '트레이너가 거절했습니다.' : null,
        };
      });

    res.json({
      success: true,
      appliedServices: appliedServices,
      message: '구매한 상품 조회 성공',
    });
  } catch (error) {
    console.error('구매한 상품 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다',
      appliedServices: [],
    });
  }
};

module.exports = {
  createTrainerBuy,
  getUserPurchasedProducts,
};
