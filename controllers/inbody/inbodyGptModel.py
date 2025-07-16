import sys
import os
import json
import psycopg2
from dotenv import load_dotenv
import logging
import re
from PIL import Image
import base64
import io
import cv2
import numpy as np
import openai

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# ---------------- 설정 ----------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stderr)],
    encoding='utf-8'
)

load_dotenv()

DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASS")
openai.api_key = os.getenv("OPEN_AI_API_KEY")

div = sys.argv[1]
file_id = sys.argv[2]
model = sys.argv[3]

# ---------------- DB 조회 ----------------
class DBAgent:
    def conn(self):
        return psycopg2.connect(
            host=DB_HOST, port=DB_PORT, dbname=DB_NAME, 
            user=DB_USER, password=DB_PASSWORD
        )
        
    def get_file_info(self):
        conn = None
        cur = None
        try:
            conn = self.conn()
            cur = conn.cursor()
            cur.execute("""
                SELECT FILE_PATH
                FROM FILE 
                WHERE FILE_ID = %s
            """, (file_id,))
            row = cur.fetchone()
            return row[0] if row else None
        except Exception as e:
            error_except("DB 연결 실패: " + str(e))
        finally:
            if cur:
                cur.close()
            if conn:
                conn.close()

# ---------------- 이미지 전처리 ----------------
def deskew_image(file_path):
    # 이미지 열기
    img = cv2.imread(file_path, cv2.IMREAD_COLOR)
    if img is None:
        error_except(f"이미지를 읽을 수 없습니다: {file_path}")
    
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # 이진화
    _, bw = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    # 좌표 추출
    coords = np.column_stack(np.where(bw > 0))
    
    if len(coords) == 0:
        # 텍스트가 없는 경우 원본 이미지 반환
        return Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    
    angle = cv2.minAreaRect(coords)[-1]
    # 각도 보정
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle
    # 회전 행렬 생성 및 적용
    (h, w) = img.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    # PIL 이미지로 변환
    return Image.fromarray(cv2.cvtColor(rotated, cv2.COLOR_BGR2RGB))

# ---------------- 이미지 리사이즈 및 인코딩 ----------------
def resize_and_encode_image(image_input, max_size=(768, 768)) -> str:
    # PIL Image 객체인 경우
    if hasattr(image_input, 'mode'):
        img = image_input
    else:
        # 파일 경로인 경우
        img = Image.open(image_input)
    
    img.thumbnail(max_size)  # 크기 비율 유지하면서 축소
    buffered = io.BytesIO()
    img.save(buffered, format="JPEG")
    img_bytes = buffered.getvalue()
    return base64.b64encode(img_bytes).decode("utf-8")

# ---------------- GPT Vision 인바디 이미지 분석 ----------------
def analyze_inbody_image_with_gpt(base64_image: str) -> dict:
    try:
        response = openai.chat.completions.create(
            model=model,
            temperature=0.2,  # 감정온도 : 가능한 낮춰서 좀도 결정론적으로 응답하도록 처리
            messages=[
                {
                    "role": "system",
                    "content": (
                        "당신은 인바디 측정 결과 분석 전문가입니다. 주어진 인바디 측정 결과 이미지를 분석하여 인바디 측정 결과를 JSON 형식으로 반환하세요. 내용은 한국어로 작성해주세요.\n"
                        "이미지에서 다음 정보들을 추출해주세요:\n"
                        "- 체중 (kg)\n"
                        "- 체수분 (L)\n"
                        "- 인바디점수\n"
                        "- 단백질 (kg)\n"
                        "- 무기질 (kg)\n"
                        "- 체지방 (kg)\n"
                        "- 체지방률 (%)\n"
                        "- BMI\n"
                        "- 골격근량 (kg)\n"
                        "- 몸통근육량 (kg)\n"
                        "- 왼팔근육량 (kg)\n"
                        "- 오른팔근육량 (kg)\n"
                        "- 왼다리근육량 (kg)\n"
                        "- 오른다리근육량 (kg)\n"
                        "- 몸통체지방 (kg)\n"
                        "- 왼팔체지방 (kg)\n"
                        "- 오른팔체지방 (kg)\n"
                        "- 왼다리체지방 (kg)\n"
                        "- 오른다리체지방 (kg)\n"
                        "결과는 반드시 다음 형식의 JSON String 형태로 제공하세요: "
                        "{\"weight\": 숫자, \"bodyWater\": 숫자, \"inbodyScore\": 숫자, \"protein\": 숫자, \"mineral\": 숫자, "
                        "\"bodyFatMass\": 숫자, \"bodyFatPercent\": 숫자, \"bmi\": 숫자, \"skeletalMuscleMass\": 숫자, "
                        "\"trunkMuscleMass\": 숫자, \"leftArmMuscleMass\": 숫자, \"rightArmMuscleMass\": 숫자, "
                        "\"leftLegMuscleMass\": 숫자, \"rightLegMuscleMass\": 숫자, \"trunkFatMass\": 숫자, "
                        "\"leftArmFatMass\": 숫자, \"rightArmFatMass\": 숫자, \"leftLegFatMass\": 숫자, "
                        "\"rightLegFatMass\": 숫자} "
                        "값이 없는 경우 null로 표시해주세요. JSON String 형태 외 문자열은 아무것도 작성하지마세요."
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
            max_tokens=1000,
        )
        
        cleaned = re.sub(r'```(?:json)?\s*([\s\S]*?)\s*```', r'\1', response.choices[0].message.content)
        result = cleaned.replace('```', '').replace('json', '').strip()
        
        # JSON 파싱 시도
        try:
            parsed_result = json.loads(result)
        except json.JSONDecodeError as e:
            logging.error(f"JSON 파싱 실패: {e}")
            return {}  # 또는 {"error": "JSON parse failed"}

        # 필드 유효성 검증 및 정제
        expected_keys = {
            "weight", "bodyWater", "inbodyScore", "protein", "mineral",
            "bodyFatMass", "bodyFatPercent", "bmi", "skeletalMuscleMass",
            "trunkMuscleMass", "leftArmMuscleMass", "rightArmMuscleMass",
            "leftLegMuscleMass", "rightLegMuscleMass", "trunkFatMass",
            "leftArmFatMass", "rightArmFatMass", "leftLegFatMass", "rightLegFatMass"
        }
        cleaned_result = {k: parsed_result.get(k, None) for k in expected_keys}

        return cleaned_result
        
    except Exception as e:
        error_except(f"GPT Vision 분석 오류: {e}")

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

# ---------------- 실행 흐름 ----------------
def run():
    if len(sys.argv) < 4:
        return error_except("파라미터가 부족합니다.")

    if div == "inbody_gpt":
        process_inbody_gpt()
    else:
        return error_except("지원하지 않는 작업 구분입니다.")

def process_inbody_gpt():
    try:
        # 파일 경로 조회
        file_path = DBAgent().get_file_info()
        if not file_path:
            error_except("파일을 찾을 수 없습니다.")
        
        # 이미지 분석
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../'))
        normalized_path = file_path.lstrip('/')
        image_path = os.path.join(base_dir, normalized_path)
        
        # 파일 존재 확인
        if not os.path.exists(image_path):
            error_except(f"이미지 파일이 존재하지 않습니다: {image_path}")
        
        # 이미지 보정
        deskewed_image = deskew_image(image_path)
        
        # 이미지 리사이즈 및 base64 인코딩
        base64_image = resize_and_encode_image(deskewed_image)

        # GPT Vision으로 인바디 이미지 분석 실행
        analyzed_data = analyze_inbody_image_with_gpt(base64_image)

        print("=============== inbody_gpt 결과 ==============", file=sys.stderr)
        
        print(json.dumps({"success": "true", "content": {"analyzed_data": analyzed_data}}, ensure_ascii=False), file=sys.stdout, flush=True)
        
    except Exception as e:
        error_except(f"인바디 분석 오류: {e}")

# ---------------- 에러 처리 ----------------
def error_except(message):
    print(f"[ERROR] {message}", file=sys.stderr)
    print(json.dumps({
        "success": "false",
        "message": str(message)
    }))
    sys.exit(1)

if __name__ == "__main__":
    run() 