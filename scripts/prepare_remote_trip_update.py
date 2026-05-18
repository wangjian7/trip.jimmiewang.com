import datetime
import json
import pathlib


SOURCE_PATH = pathlib.Path("/tmp/remote_trip_before_update.json")
BACKUP_PATH = pathlib.Path("/tmp/remote_trip_au_2026_09_30_backup_plan.json")
SQL_PATH = pathlib.Path("/tmp/update_remote_trip_au_2026_09_30.sql")
SLUG = "au-2026-09-30"


def main() -> None:
    payload = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    plan_json = payload[0]["results"][0]["plan_json"]
    BACKUP_PATH.write_text(plan_json, encoding="utf-8")

    plan = json.loads(plan_json)
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

    updated_plan_json = json.dumps(
        plan,
        ensure_ascii=False,
    ).replace("'", "''")
    now = datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    sql = (
        "UPDATE trips "
        f"SET plan_json = '{updated_plan_json}', updated_at = '{now}' "
        f"WHERE slug = '{SLUG}';\n"
        "SELECT slug, updated_at "
        f"FROM trips WHERE slug = '{SLUG}';\n"
    )
    SQL_PATH.write_text(sql, encoding="utf-8")
    print(BACKUP_PATH)
    print(SQL_PATH)
    print(now)


if __name__ == "__main__":
    main()
