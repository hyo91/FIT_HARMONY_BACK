const { sendQuery } = require('../../config/database'); 
const { getPermission } = require('./boardControllers');

const PAGE_NUM = 10;
const COMMENT_PAGE_NUM = 20;

const getPageCount = async (req,res)=>{
  const { boardId } = req.params;
  const { keyword, key_type } = req.query;
  
  const allowedKeyTypes = ["title", "nick_name", "content"];
  const keyTypeSafe = allowedKeyTypes.includes(key_type) ? key_type : null;
  
  const params = [];
  let paramIdx = 1;
  
  const whereClauses = ["is_deleted = FALSE"];
  
  if (boardId && boardId !== "undefined") {
    whereClauses.push(`category_id = $${paramIdx++}`);
    params.push(parseInt(boardId, 10));
  }
  
  if (
    keyword &&
    keyword !== "null" &&
    keyword !== "undefined" &&
    keyword.trim() !== "" &&
    keyTypeSafe
  ) {
    const keywordParam = `%${keyword}%`;
  
    if (keyTypeSafe === "content") {
    const contentClause = `
      EXISTS (
        SELECT 1
        FROM jsonb_path_query(content::jsonb, '$.**.text') AS t(text_value)
        WHERE trim(t.text_value::text, '"') ILIKE $${paramIdx++}
      )
    `;
    whereClauses.push(contentClause);
    params.push(`%${keyword}%`);
    } else {
      whereClauses.push(`${keyTypeSafe} ILIKE $${paramIdx++}`);
      params.push(keywordParam);
    }
  }
  
  const query = `
    SELECT COUNT(*) AS total_count
    FROM post
    WHERE ${whereClauses.join(' AND ')}
  `;
  
  // 로깅
  // console.log("COUNT QUERY", query);
  // console.log("COUNT PARAMS", params);
  
  
  try {
    const result = await sendQuery(query, params);
    // const result = await sendQuery(query);
    const pageCount =  Math.ceil(result[0].totalCount/PAGE_NUM);
    // console.log(result)
    // res.json({pageCount, success:true});
    return pageCount;
  } catch (error) {
    console.log(error);
    // res.json({success:false});
    return 1;
  }
}

const getPosts = async (req,res)=>{
  const {boardId} = req.params;
  const {page, keyword, key_type} = req.query;
  try {
    let page_num = 0;
    if (page && !isNaN(parseInt(page, 10))) {
      page_num = (parseInt(page, 10) - 1) * PAGE_NUM;
    }
    if (page_num < 0) page_num = 0;

    const allowedKeyTypes = ["title", "nick_name", "content"];
    const keyTypeSafe = allowedKeyTypes.includes(key_type) ? key_type : null;
    
    const params = [];
    let paramIdx = 1;
    
    const whereClauses = ["is_deleted = FALSE"];
    console.log("BoardID : ", boardId)
    if (boardId && boardId !== "undefined" && boardId !== "NaN" && boardId !== NaN) {
      whereClauses.push(`category_id = $${paramIdx++}`);
      params.push(parseInt(boardId, 10));
    }
    
    // keyword가 값이 있을 때만 조건 추가
    if (
      keyword &&
      keyword !== NaN &&
      keyword !== "NaN" &&
      keyword !== "null" &&
      keyword !== "undefined" &&
      keyword.trim() !== "" &&
      keyTypeSafe
    ) {
      const keywordParam = `%${keyword}%`;
    
      if (keyTypeSafe === "content") {
      const contentClause = `
          EXISTS (
            SELECT 1
            FROM jsonb_path_query(content::jsonb, '$.**.text') AS t(text_value)
            WHERE trim(t.text_value::text, '"') ILIKE $${paramIdx++}
          )
        `;
        whereClauses.push(contentClause);
        params.push(`%${keyword}%`);
      } else {
        whereClauses.push(`${keyTypeSafe} ILIKE $${paramIdx++}`);
        params.push(keywordParam);
      }
    }

    const query = `
        SELECT
          post_id, user_id, nick_name, category_id, title, view_cnt, 
          parent_post_id, path, depth, created_time, updated_time, content,
          (
            SELECT COUNT(*) FROM comment AS c WHERE c.post_id = post.post_id
          ) AS comment_cnt
        FROM post
        LEFT JOIN (
          SELECT nick_name, user_name, user_id AS usr_id FROM "USER"
        ) AS usr
        ON usr.usr_id = post.user_id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY post_id DESC
        LIMIT $${paramIdx}
        OFFSET $${paramIdx + 1}
      `;

    // LIMIT, OFFSET 고정 위치

    params.push(Number(PAGE_NUM));
    params.push(Number(page_num));
    // console.log("QUERY", query);
    // console.log("PARAMS", params);
    const posts = await sendQuery(query,params);
    const pageCount = await getPageCount(req,res);
    console.log("search Count : ",posts.length + " : " + pageCount);
    res?.json({data:{posts,pageCount}, success:true});
  } catch (error) {
    console.log(error);
    res?.json({success:false})
  }
  return;
}

const getFilteredPosts = async (req, res)=>{
  const {boardId} = req.params;
  const {page, keyword, key_type} = req.query;
  let role = 'OTHERS'
  if (req.isAuthenticated())
    role = req.user.role;

  try {
    let page_num = 0;
    if (page && !isNaN(parseInt(page, 10))) {
      page_num = (parseInt(page, 10) - 1) * PAGE_NUM;
    }
    if (page_num < 0) page_num = 0;

    const allowedKeyTypes = ["title", "nick_name", "content"];
    const keyTypeSafe = allowedKeyTypes.includes(key_type) ? key_type : null;
    
    const params = [];
    let paramIdx = 1;
    
    const whereClauses = ["is_deleted = FALSE"];




    console.log("BoardID : ", boardId)
    if (boardId && boardId !== "undefined" && boardId !== "NaN" && boardId !== NaN) {
      whereClauses.push(`category_id = $${paramIdx++}`);
      params.push(parseInt(boardId, 10));
    }
    
    whereClauses.push(`
      post.category_id IN (
        SELECT category_id
        FROM post_category_permission
        WHERE role = $${paramIdx++} AND permission = 'read'
      )
    `);
    params.push(role);

    // keyword가 값이 있을 때만 조건 추가
    if (
      keyword &&
      keyword !== NaN &&
      keyword !== "NaN" &&
      keyword !== "null" &&
      keyword !== "undefined" &&
      keyword.trim() !== "" &&
      keyTypeSafe
    ) {
      const keywordParam = `%${keyword}%`;
    
      if (keyTypeSafe === "content") {
      const contentClause = `
          EXISTS (
            SELECT 1
            FROM jsonb_path_query(content::jsonb, '$.**.text') AS t(text_value)
            WHERE trim(t.text_value::text, '"') ILIKE $${paramIdx++}
          )
        `;
        whereClauses.push(contentClause);
        params.push(`%${keyword}%`);
      } else {
        whereClauses.push(`${keyTypeSafe} ILIKE $${paramIdx++}`);
        params.push(keywordParam);
      }
    }

    const query = `
        SELECT
          post_id, user_id, nick_name, category_id, title, view_cnt, 
          parent_post_id, path, depth, created_time, updated_time, content,
          (
            SELECT COUNT(*) FROM comment AS c WHERE c.post_id = post.post_id and c.is_deleted = FALSE
          ) AS comment_cnt
        FROM post
        LEFT JOIN (
          SELECT nick_name, user_name, user_id AS usr_id FROM "USER"
        ) AS usr
        ON usr.usr_id = post.user_id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY post_id DESC
        LIMIT $${paramIdx}
        OFFSET $${paramIdx + 1}
      `;

    // LIMIT, OFFSET 고정 위치

    params.push(Number(PAGE_NUM));
    params.push(Number(page_num));
    // console.log("QUERY", query);
    // console.log("PARAMS", params);
    const posts = await sendQuery(query,params);
    const pageCount = await getPageCount(req,res);
    console.log("search Count : ",posts.length + " : " + pageCount);
    res?.json({data:{posts,pageCount}, success:true});
  } catch (error) {
    console.log(error);
    res?.json({success:false})
  }
  return;
}

const getPost = async (req,res)=>{
  const {postId} = req.params;
  try {
    const posts= await sendQuery(
      `
      UPDATE post
      SET view_cnt = view_cnt + 1
      FROM "USER" u
      WHERE post.post_id = $1
        AND post.user_id = u.user_id
      RETURNING 
        post.*,
        u.nick_name;
      `,[postId]
    )
    if ((!posts)||posts.length == 0){
      res.status(404).json({msg:"게시물을 찾을수 없습니다.", success:false})
      return;
    }  
    res.status(200).json({
      data:posts[0],
      success:true
    });
  } catch (error) {
    res.json({success:false})
  }
}


const createPost = async (req,res)=>{
  if (req.isAuthenticated() == false){
    return res.json({msg:"회원이 아닙니다.", success : false});
  }
  try {
    const form = req.body;
    const {user} = req;
    const {board_id, title, content} = form;
    const {userId} = user;
    const path = "/";
    const depth = 1;
    // console.log(content)
    const permission = await getPermission({query:{
      role:user.role, boardId: board_id, permission:'write'
    }});
    console.log("this Permission : ", permission);
    if(permission == false){
      res.json({msg:"게시판 작성 권한이 없습니다.", success:false})
      return;
    }

    posts = await sendQuery("insert into post(user_id, category_id, title, content, path, depth, is_deleted) values($1, $2, $3, $4, $5, $6, $7) returning post_id",
      [userId, board_id, title, content, path, depth,false]);
    // console.log(posts);

    res.json({msg:"작성이 완료되었습니다.", postId : posts[0].postId, success: true});
  } catch (error) {
    res.json({msg:"작성이 실패", success: false});
  }
  
}

const deletePost = async (req,res)=>{
  if (req.isAuthenticated() == false){
    return res.json({msg:"회원이 아닙니다."});
  }
  const {userId:authId} = req.user;
  const {userId:reqId, postId} = req.body;
  // console.log(req.body);
  if(authId !== reqId){
    res.json({msg:"권한이 없습니다1.", success:false});
    return;
  }

  const target = await sendQuery(`select user_id from post where post_id = $1`,[postId]);
  if(target.length ===0)
    return res.json({msg:"존재하지 않는 게시글 입니다.", success:false});
  const dbUser = target[0].userId;
  // console.log(target);
  // console.log(authId, reqId, dbUser)
  if(authId !== dbUser){
    res.json({msg:"권한이 없습니다.", success:false});
    return;
  }
  await sendQuery(`update post set is_deleted = $1 where post_id = $2`,[true,postId]);
  res.json({msg:"삭제가 완료되었습니다.", success:true});
}

const updatePost = async (req,res)=>{
  if (req.isAuthenticated() == false){
    return res.json({msg:"회원이 아닙니다."});
  }
  const {user} = req;
  const {userId:authId} = req.user;
  const form = req.body;
  const {post_id, title, content,board_id} = form;

  const target = await sendQuery(`select user_id from post where post_id = $1`,[post_id]);
  if(target.length ===0)
    return res.json({msg:"찾을 수 없는 게시글 입니다.", success:false});
  const dbUser = target[0].userId;

  const permission = await getPermission({query:{
    role:user.role, boardId: board_id, permission:'write'
  }});
  console.log("this Permission : ", permission);
  if(permission == false){
    res.json({msg:"게시판 작성 권한이 없습니다.", success:false})
    return;
  }


  console.log(target);
  // console.log(authId, reqId, dbUser)
  if(authId !== dbUser){
    res.json({msg:"권한이 없습니다.", success:false});
    return;
  }
  await sendQuery(`update post set title = $1, content = $2, category_id = $4 where post_id = $3`,[title,content,post_id,board_id]);
  res.json({msg:"게시글 수정이 완료되었습니다.", success:true});
}

const getCommentPageCount = async (req,res)=>{
  const {postId} = req.params;
  const query = `
    SELECT COUNT(*) AS total_count
    FROM comment
    WHERE post_id = $1
  `;
  const params= [postId];
  try {
    const result = await sendQuery(query, params);
    const pageCount =  Math.ceil(result[0].totalCount/COMMENT_PAGE_NUM);
    res?.json({pageCount,success:true})
    return pageCount;
  } catch (error) {
    console.log(error);
    res?.json({success:false})
    return 1;
  }
}

const getComments = async (req, res)=>{
  const {postId} = req.params;
  const {page} = req.query;
  try {
    let page_num = 0;
    if (page && !isNaN(parseInt(page, 10))) {
      page_num = (parseInt(page, 10) - 1) * COMMENT_PAGE_NUM;
    }
    if (page_num < 0) page_num = 0;

    const comments = await sendQuery(
      `
      select comment_id, post_id, nick_name, user_id, content, is_deleted, parent_comment_id, path, depth, created_time, updated_time 
      from comment c
      left join (select nick_name, user_id as usr_id from "USER") as usr
      on c.user_id = usr.usr_id
      where post_id = $1 
        and (is_deleted = false OR 
            EXISTS (
            SELECT 1
            FROM comment child
            WHERE child.parent_comment_id = c.comment_id and child.is_deleted = false
        ))
      order by path
      LIMIT $2
      OFFSET $3
      `,[postId, COMMENT_PAGE_NUM, page_num]
    );

    const pageCount = await getCommentPageCount(req);

    res.json({data:{comments,pageCount}, success:true});
  } catch (error) {
    res.json({success:false});
  }
}

const getFindComment = async (req,res)=>{
  const {commentId, postId} = req.params;
  const query = `
      WITH ordered_comments AS (
        SELECT
          comment_id,
          ROW_NUMBER() OVER (
            ORDER BY path ASC
          ) AS row_num
        FROM comment
        WHERE post_id = $1
      )
      SELECT
        row_num,
        CEIL(row_num::decimal / $2) AS page_number
      FROM ordered_comments
      WHERE comment_id = $3;
      `
  const params = [postId,COMMENT_PAGE_NUM, commentId];
  try {
    const result = await sendQuery(query, params);
    res?.json({page:result[0].pageNumber, success:true});
    return result[0].pageNumber;
  } catch (error) {
    res?.json({success:false});
    return -1;
  }
}

const deleteComment = async (req,res) => {
  if (req.isAuthenticated() == false){
    return res.json({msg:"회원이 아닙니다."});
  }
  const {userId:authId} = req.user;
  const {userId:reqId, commentId} = req.body;
  // console.log(req.body);
  if(authId !== reqId){
    res.json({msg:"권한이 없습니다1.", success:false});
    return;
  }

  const target = await sendQuery(`select user_id from comment where comment_id = $1`,[commentId]);
  if(target.length ===0)
    return res.json({msg:"존재하지 않는 댓글 입니다.", success:false});
  const dbUser = target[0].userId;
  // console.log(target);
  // console.log(authId, reqId, dbUser)
  if(authId !== dbUser){
    res.json({msg:"권한이 없습니다.", success:false});
    return;
  }
  await sendQuery(`update comment set is_deleted = $1 where comment_id = $2`,[true,commentId]);
  res.json({msg:"삭제가 완료되었습니다.", success:true});
}

const createComment = async (req,res)=>{
  if (req.isAuthenticated() == false){
    return res.json({msg:"회원이 아닙니다.", success : false});
  }
  try {
    const form = req.body;
    const {user} = req;
    const {post_id, content,parent_comment_id} = form;
    const {userId} = user;
    console.log(content)
    const parentInfo = {
      path : "", depth:0, child_cnt:0
    }

    if(parent_comment_id){
      const parent_res = await sendQuery(`
        select path, depth from comment where comment_id = $1
        `,[parent_comment_id]);
      parentInfo.path = parent_res[0].path;
      parentInfo.depth = parent_res[0].depth;
  
      const child_res = await sendQuery(`
        select (count(*) + 1) as child_num from comment where parent_comment_id = $1
        `,[parent_comment_id]);
      
      parentInfo.child_cnt = child_res[0].childNum;
    }else{
      const child_res = await sendQuery(`
        select (count(*) + 1) as child_num from comment where post_id = $1 and parent_comment_id is null
        `,[post_id]);
      parentInfo.child_cnt = child_res[0].childNum;
    }
    console.log(parentInfo);
    const path = `${parentInfo.path} ${parentInfo.child_cnt.toString().padStart(2,'0')}`.trim();
    const depth = parentInfo.depth +1;
    
    console.log(path,depth);

    await sendQuery("insert into comment(user_id, post_id, content,parent_comment_id, path, depth, is_deleted) values($1, $2, $3, $4, $5, $6, $7)",
      [userId, post_id, content,parent_comment_id, path, depth,false]);
    // console.log(posts);

    res.json({msg:"작성이 완료되었습니다.", success: true});
  } catch (error) {
    console.log(error)
    res.json({msg:"작성이 실패", success: false});
  }
  
}

const updateComment = async (req, res)=>{
  if (req.isAuthenticated() == false){
    return res.json({msg:"회원이 아닙니다.", success : false});
  }
  const {userId:authId} = req.user;
  const {userId:reqId, commentId, content} = req.body;
  // console.log(req.body);
  if(authId !== reqId){
    res.json({msg:"권한이 없습니다1.", success:false});
    return;
  }
  const target = await sendQuery(`select user_id from comment where comment_id = $1`,[commentId]);
  if(target.length ===0)
    return res.json({msg:"존재하지 않는 댓글 입니다.", success:false});
  const dbUser = target[0].userId;
  // console.log(target);
  // console.log(authId, reqId, dbUser)
  if(authId !== dbUser){
    res.json({msg:"권한이 없습니다.", success:false});
    return;
  }

  await sendQuery(`
    update comment set content = $1 where comment_id = $2
    `,[content, commentId])
  res.json({msg:"수정이 완료되었습니다.", success:true});
}

module.exports = {
  getPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  getComments, 
  createComment, 
  deleteComment, 
  updateComment,
  getFindComment,
  getFilteredPosts
};