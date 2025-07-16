const express = require('express');
const router = express.Router();
const { getUserInbodyDayData, getUserInbodyMonthData, insertInbodyData, updateInbodyData, deleteInbodyData, requestInbodyOcr } = require('../../controllers/inbody/inbodyControllers');

// 미들웨어 - 인증 확인 (필요시 사용)
// const { authenticateToken } = require('../../middleware/auth');

/**
 * @route   POST /inbody/requestOcr
 * @desc    인바디 결과지 분석 요청
 * @access  Public (또는 Private - 인증 필요시)
 */
router.post('/requestOcr', requestInbodyOcr);

/**
 * @route   PUT /inbody/update
 * @desc    특정 사용자의 Inbody 데이터 수정
 * @access  Public (또는 Private - 인증 필요시)
 */
router.put('/update', updateInbodyData);

/**
 * @route   GET /inbody/:userId?inbodyTime=:inbodyTime
 * @desc    특정 사용자의 Inbody 일일 데이터 조회
 * @access  Public (또는 Private - 인증 필요시)
 */
router.get('/:userId', getUserInbodyDayData);

/**
 * @route   GET /inbody/:userId/month?inbodyMonthTime=:inbodyMonthTime
 * @desc    특정 사용자의 Inbody 월간 데이터 조회
 * @access  Public (또는 Private - 인증 필요시)
 */
router.get('/:userId/month', getUserInbodyMonthData);

/**
 * @route   POST /inbody/:userId
 * @desc    특정 사용자의 Inbody 데이터 등록
 * @access  Public (또는 Private - 인증 필요시)
 */
router.post('/:userId', insertInbodyData);

/**
 * @route   DELETE /inbody/:inbodyId
 * @desc    특정 인바디 데이터 삭제
 * @access  Public (또는 Private - 인증 필요시)
 */
router.delete('/:inbodyId', deleteInbodyData);

module.exports = router; 