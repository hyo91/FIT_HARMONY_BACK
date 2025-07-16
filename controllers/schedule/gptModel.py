import sys
import os
import json
import openai
import psycopg2
from dotenv import load_dotenv
from datetime import datetime, timedelta
import logging
import re
import difflib
from PIL import Image
import base64
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# ---------------- 설정 ----------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        # logging.FileHandler("D:/log/gptmodelLog.log", encoding="utf-8"),
        logging.StreamHandler()
    ]
)


load_dotenv()

DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASS")
openai.api_key = os.getenv("OPEN_AI_API_KEY")

div = sys.argv[1]
model = sys.argv[2]
prompt = sys.argv[3]
data = sys.argv[4]

# ---------------- GPT 호출 함수 ----------------
def gpt_call(role_name, messages):
    logging.info(f"Calling GPT ({role_name})")
    try:
        response = openai.chat.completions.create(
            model=model,
            temperature=0.2,
            messages=messages,
            max_tokens=2048
        )
        content = response.choices[0].message.content.strip()
        logging.info(f"GPT 응답 ({role_name}): {content}")
        return content
    except Exception as e:
        error_except(f"GPT 호출 오류 ({role_name}): {e}")

# ---------------- JSON 추출 ----------------
def extract_json(text):
    try:
        match = re.search(r'```json\s*(\{.*\}|\[.*\])\s*```', text, re.DOTALL)
        if not match:
            match = re.search(r'(\{.*\}|\[.*\])', text, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        else:
            raise ValueError("JSON not found in GPT response.")
    except Exception as e:
        error_except(f"GPT 응답이 JSON 형식이 아닙니다. 원문: {text}")

# ---------------- DB 조회 ----------------
class DBAgent:
    def conn(self) :
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        return conn
    
    def get_activity_list(self):
        try:
            conn = self.conn()
            cur = conn.cursor()
            cur.execute("""
                SELECT CODE_ID, CODE_NAME, DESCRIPTION 
                FROM CODE_DETAIL 
                WHERE CODE_CLASS = 'C001'
            """)
            rows = cur.fetchall()
            activities = []
            for row in rows:
                code_id, name, desc = row
                try:
                    kcal_raw, unit_raw = desc.split('|')
                    unit_type = 'T' if '시' in unit_raw else 'C'
                    unit = '시간' if unit_type == 'T' else '회'
                    activities.append({
                        "id": code_id,
                        "name": name,
                        "unit": unit,
                        "kcal": float(kcal_raw),
                        "unit_type": unit_type
                    })
                except:
                    continue
            logging.info(f"운동 코드 목록 조회: {json.dumps(activities, ensure_ascii=False)}")
            return activities
        except Exception as e:
            error_except("DB 연결 실패: " + str(e))
    
    def get_file_info(self) : 
        try:
            conn = self.conn()
            cur = conn.cursor()
            cur.execute(f"""
                SELECT FILE_PATH
                FROM FILE 
                WHERE FILE_ID = {prompt}
            """)
            row = cur.fetchone()
            return row[0]
        except Exception as e:
            error_except("DB 연결 실패: " + str(e))
            
            
            
# ---------------- 실행 흐름 ----------------
def run():
    if len(sys.argv) < 5:
        return error_except("파라미터가 부족합니다.")

    if div == "schedule":
        gpt_schedule()
    elif div == "diet" :
        get_diet()
    else :
        return error_except("지원하지 않는 작업 구분입니다.")


def get_diet() : 
    file_path = DBAgent().get_file_info()
    base64_image = resize_and_encode_image(file_path)
    result = analyze_food_image(base64_image)
    
    logging.info(" =============== gpt_model get_diet ============= ")
    logging.info(result)
    
    print(json.dumps({"success": "true", "content": result}, ensure_ascii=False))
    
    
def resize_and_encode_image(file_path: str, max_size=(768, 768)) -> str:
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../'))
    normalized_path = file_path.lstrip('/')
    image_path = os.path.join(base_dir, normalized_path)
    
    img = Image.open(image_path)
    img.thumbnail(max_size)  # 크기 비율 유지하면서 축소
    buffered = io.BytesIO()
    img.save(buffered, format="JPEG")
    img_bytes = buffered.getvalue()
    return base64.b64encode(img_bytes).decode("utf-8")

def analyze_food_image(base64_image: str) -> dict:
    response = openai.chat.completions.create(
        model=model,
        temperature=0.2, # 감정온도 : 가능한 낮춰서 좀도 결정론적으로 응답하도록 처리
        messages=[
            {
                "role": "system",
                "content": (
                    "당신은 음식 이미지 분석 전문가입니다. 주어진 이미지를 보고 음식 이름, 주요 토핑, 예상 칼로리를 JSON 형식으로 반환하세요. 데이터는 음식만 반환해주세요. 내용은 한국어로 작성해주세요.\n"
                    "주어진 이미지에서 가장 중심이 되는 메인 요리(주로 단백질을 포함한 메인 식재료를 사용하며, 구이, 튀김, 찜 등 다양한 조리 방식으로 제공하는 요리) 여부를 true / false로 제공하세요."
                    "메인 메뉴는 반드시 1개 입니다. 선정되지 않는 경우 첫번째 음식을 메인 요리로 판단해주세요."
                    "메인 요리로 판단된 음식의 카테고리(종류)를 작성해주세요. 카테고리는 너무 큰 카테고리가 아닌 메인 요리의 종류로 작성해주세요."
                    "결과는 반드시 다음 형식의 배열 JSON String 형태로 제공하세요: [{\"name\": \"음식명\", \"topping\": [\"토핑1\", ...], \"isMainDish\": true 또는 false, \"category\":\"카테고리\", \"totalCal\": 숫자] 음식이 하나도 없으면 []와 같이 빈 배열 JSON String 형태로 제공해주세요.JSON String 형태 외 문자열은 아무것도 작성하지마세요."
                ),
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}"
                        },
                    }
                ],
            },
        ],
        max_tokens=300,
    )
    
    
    cleaned = re.sub(r'```(?:json)?\s*([\s\S]*?)\s*```', r'\1', response.choices[0].message.content)
    result = cleaned.replace('```', '').replace('json', '').strip()
    
    logging.info("================ analyze_food_image ==================")
    logging.info(result)
    return result
    
    
    

# schedule
def gpt_schedule() :
    profile = json.loads(data)
    age = profile.get("age")
    height = profile.get("height")
    weight = profile.get("weight")
    gender = "남자" if profile.get("gender") == "M" else "여자"

    db_data = DBAgent().get_activity_list()
    activity_desc = ', '.join([
        f"{a['name']}({a['unit']}당 {a['kcal']}kcal)"
        for a in db_data
    ])

    now = datetime.now()
    fmt = "%Y-%m-%d %H:%M"
    analysis_result = {
        'from': now.strftime(fmt),
        'to': (now + timedelta(days=30)).strftime(fmt),
        'goal': prompt,
        'preferredTime': 'any',
        'level': '중간',
        'maxDuration': 120,
        'maxCount': 200
    }

    preferred_time = analysis_result['preferredTime']
    time_range_msg = {
        "오전": "오전 6시~오전 11시",
        "오후": "오후 12시~오후 5시",
        "저녁": "오후 6시~밤 10시",
        "퇴근 후": "오후 6시~밤 10시"
    }.get(preferred_time, "아침 7시~저녁 10시")

    recommender_prompt = [
        {"role": "system", "content": (
            f"나이 {age}세, 성별 {gender}, 키 {height}cm, 몸무게 {weight}kg인 사용자에게\n"
            f"운동 강도 {analysis_result['level']}, 하루 최대 {analysis_result['maxDuration']}분 제한 내에서\n"
            f"운동 목적: {analysis_result['goal']}\n"
            f"다음 운동 리스트에서만 고르세요: {activity_desc} (정확한 이름 사용).\n"
            "운동 강도는 점진적으로 증가하며, 하루 2~3가지 운동으로 구성된 루틴을 구성하세요.\n"
            "같은 운동은 가능하면 동일한 시간대에 반복되도록 구성하세요.\n"
            "결과는 JSON 형식으로 추천: [{\"name\":\"운동명\"}]"
        )}
    ]
    recommend_result = extract_json(gpt_call("recommender", recommender_prompt))

    names_from_recommend = []
    for r in recommend_result:
        if isinstance(r, dict) and 'name' in r:
            names_from_recommend.append(r['name'])
        elif isinstance(r, str):
            names_from_recommend.append(r)

    scheduler_prompt = [
        {"role": "system", "content": (
            f"운동은 반드시 이 목록에서만 고르세요: {', '.join(names_from_recommend)} (정확한 이름 사용 필수).\n"
            f"스케줄 범위: {analysis_result['from']}부터 {analysis_result['to']}까지, 하루 최대 {analysis_result['maxDuration']}분, 시간대: {time_range_msg}.\n"
            "하루 2~3개의 운동 루틴을 구성하고, 같은 종류는 동일 시간대 반복, 점진적 강도 증가, 무리한 시간(예: 걷기 60시간)은 금지.\n"
            "운동 시간은 GPT가 추론하지 말고 서버에서 계산합니다. 운동은 이름만 포함하고 하루별 리스트로 구성하세요.\n"
            "결과는 JSON 형식: [{\"day\": 1, \"exercises\": [{\"name\":\"운동명\"}]}]"
        )}
    ]
    schedule_result = extract_json(gpt_call("scheduler", scheduler_prompt))

    def find_code_id_and_unit(name):
        for a in db_data:
            if name.strip() == a['name']:
                return a['id'], a['unit'], a['unit_type'], a['kcal']
            ratio = difflib.SequenceMatcher(None, name.strip(), a['name']).ratio()
            if ratio > 0.85:
                return a['id'], a['unit'], a['unit_type'], a['kcal']
        return "UNKNOWN", "단위없음", "N", 0.0

    final_schedule = []
    for s in schedule_result:
        day = s.get("day")
        exercises = s.get("exercises", [])
        base_date = now + timedelta(days=day-1)
        base_hour = 7  # 7시 시작
        for idx, ex in enumerate(exercises):
            name = ex.get("name")
            code, unit_label, unit_type, kcal = find_code_id_and_unit(name)
            if code == "UNKNOWN":
                continue

            start_dt = datetime(base_date.year, base_date.month, base_date.day, base_hour + idx * 2, 0)
            if unit_type == "T":
                duration_min = 60
                exc_cnt = 1
            else:
                duration_min = 15
                exc_cnt = 30
            end_dt = start_dt + timedelta(minutes=duration_min)

            final_schedule.append({
                "excersiseDivision": code,
                "excersiseCnt": exc_cnt,
                "startTime": start_dt.strftime(fmt),
                "endTime": end_dt.strftime(fmt)
            })

    print(json.dumps({"success": "true", "content": final_schedule}, ensure_ascii=False))



# ---------------- 에러 처리 ----------------
def error_except(message):
    logging.error(f"[ERROR] {message}")
    print(json.dumps({
        "success": "false",
        "message": str(message)
    }))
    sys.exit(1)

if __name__ == "__main__":
    run()
