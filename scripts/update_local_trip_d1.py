import datetime
import json
import pathlib
import sqlite3


DB_PATH = pathlib.Path(
    "/Users/wangjian/nextcloud/jimmiewang/trip.jimmiewang.com/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/413fd4e246c1f84ae3775fa21bb9c46c2d29a81c8525391553586f1cb5589ec0.sqlite"
)
SLUG = "au-2026-09-30"


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute(
        "SELECT plan_json FROM trips WHERE slug = ?",
        (SLUG,),
    ).fetchone()
    if not row:
        raise SystemExit(f"Trip not found: {SLUG}")

    plan = json.loads(row[0])
    day = next(d for d in plan["days"] if d["id"] == "d-0930")
    day["flight"] = "上海出发 -> 布里斯班（优先直飞，备选香港/新加坡中转）"
    day["flights"] = [
        {
            "id": "f-0930-1",
            "flightNo": "方案 1：东航 MU715 上海浦东 -> 布里斯班（直飞）",
            "departAt": "21:10",
            "arriveAt": "09:00",
            "price": "优先关注",
            "hasLayover": False,
        },
        {
            "id": "f-0930-2",
            "flightNo": "方案 2：国泰 上海浦东 -> 香港 -> 布里斯班",
            "departAt": "傍晚出发",
            "arriveAt": "次日早上",
            "price": "中转备选",
            "hasLayover": True,
        },
        {
            "id": "f-0930-3",
            "flightNo": "方案 3：新航 上海浦东 -> 新加坡 -> 布里斯班",
            "departAt": "下午/晚上出发",
            "arriveAt": "次日早上",
            "price": "中转备选",
            "hasLayover": True,
        },
    ]
    day["notes"] = (
        "重点：护照/签证、转换插头、电话卡、行李重量。"
        "去程优先看夜间出发、次日早上抵达布里斯班的方案；落地后再转黄金海岸。"
    )

    now = datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    conn.execute(
        "UPDATE trips SET plan_json = ?, updated_at = ? WHERE slug = ?",
        (json.dumps(plan, ensure_ascii=False), now, SLUG),
    )
    conn.commit()
    conn.close()
    print(now)


if __name__ == "__main__":
    main()
