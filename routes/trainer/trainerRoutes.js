const express = require('express');
const router = express.Router();
const {
  getTrainerList,
  getTrainerDetail,
  getTrainerReview,
  getAllTrainerReviews, // 새로 추가
  getTrainerProduct,
  createTrainerReview,
} = require('../../controllers/trainer/trainer');

const {
  createTrainerBuy,
  getUserPurchasedProducts,
} = require('../../controllers/trainer/createBuyController');

router.get('/', getTrainerList);

// 사용자가 구매한 상품 조회 - /:id 보다 먼저 배치
router.get('/purchased-products', getUserPurchasedProducts);

router.get('/:id/product', getTrainerProduct);
// 더 구체적인 라우트를 먼저 배치
router.get('/:id/reviews/all', getAllTrainerReviews); // 전체 리뷰
router.get('/:id/review', getTrainerReview); // 상세페이지 3개 리뷰
router.get('/:id', getTrainerDetail);
router.post('/review', createTrainerReview); //리뷰 등록
router.post('/product/buy', createTrainerBuy); //상품 구매

module.exports = router;
