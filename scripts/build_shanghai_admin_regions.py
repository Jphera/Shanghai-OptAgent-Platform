"""Build lightweight Shanghai administrative-region data for the web app.

Outputs:
  data/shanghai-admin-major-regions.geojson
  data/shanghai-admin-local-regions.geojson
  data/shanghai-admin-region-index.json
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

import geopandas as gpd
from shapely.geometry import mapping, shape


DEFAULT_SOURCE = Path(r"F:\博士文件\石老师课题组\IBPC会议论文-第二篇\GIS地图数据汇总\03-行政区\03-行政区\新")
DEFAULT_DATA = Path("data")

DISTRICT_EN = {
    "崇明区": "Chongming District",
    "奉贤区": "Fengxian District",
    "虹口区": "Hongkou District",
    "黄浦区": "Huangpu District",
    "嘉定区": "Jiading District",
    "金山区": "Jinshan District",
    "静安区": "Jing'an District",
    "闵行区": "Minhang District",
    "浦东新区": "Pudong New Area",
    "普陀区": "Putuo District",
    "青浦区": "Qingpu District",
    "松江区": "Songjiang District",
    "徐汇区": "Xuhui District",
    "杨浦区": "Yangpu District",
    "长宁区": "Changning District",
    "宝山区": "Baoshan District",
}

LOCAL_EXACT_EN = {
    "中国（上海）自由贸易试验区（保税片区）": "China (Shanghai) Pilot Free Trade Zone, Bonded Area",
    "上海市奉贤区海湾旅游区": "Haiwan Tourism Area, Fengxian District",
    "宝山城市工业园区": "Baoshan Urban Industrial Park",
    "金桥经济技术开发区": "Jinqiao Economic and Technological Development Zone",
    "张江高科技园区": "Zhangjiang High-Tech Park",
    "菊园新区管委会": "Juyuan New Area Administrative Committee",
    "松江工业区": "Songjiang Industrial Zone",
    "金山工业区": "Jinshan Industrial Zone",
    "嘉定工业区": "Jiading Industrial Zone",
    "莘庄工业区": "Xinzhuang Industrial Zone",
    "漕河泾新兴技术开发区": "Caohejing Emerging Technology Development Zone",
    "上实现代农业园区": "Shangshi Modern Agriculture Park",
    "前卫农场": "Qianwei Farm",
    "东平林场": "Dongping Forest Farm",
    "金海社区": "Jinhai Community",
}

SUFFIX_EN = [
    ("街道", "Subdistrict"),
    ("镇", "Town"),
    ("乡", "Township"),
    ("工业区", "Industrial Zone"),
    ("开发区", "Development Zone"),
    ("园区", "Park"),
    ("管委会", "Administrative Committee"),
    ("农场", "Farm"),
    ("林场", "Forest Farm"),
    ("旅游区", "Tourism Area"),
    ("社区", "Community"),
]

PINYIN = {
    "七": "qi",
    "万": "wan",
    "三": "san",
    "上": "shang",
    "下": "xia",
    "业": "ye",
    "东": "dong",
    "中": "zhong",
    "丰": "feng",
    "临": "lin",
    "九": "jiu",
    "乡": "xiang",
    "书": "shu",
    "二": "er",
    "云": "yun",
    "五": "wu",
    "京": "jing",
    "亭": "ting",
    "仙": "xian",
    "代": "dai",
    "会": "hui",
    "佘": "she",
    "保": "bao",
    "健": "jian",
    "共": "gong",
    "兴": "xing",
    "冈": "gang",
    "农": "nong",
    "凉": "liang",
    "凌": "ling",
    "前": "qian",
    "化": "hua",
    "北": "bei",
    "区": "qu",
    "半": "ban",
    "华": "hua",
    "南": "nan",
    "卫": "wei",
    "友": "you",
    "发": "fa",
    "古": "gu",
    "叶": "ye",
    "合": "he",
    "吉": "ji",
    "向": "xiang",
    "吕": "lv",
    "吴": "wu",
    "周": "zhou",
    "和": "he",
    "唐": "tang",
    "嘉": "jia",
    "嘴": "zui",
    "四": "si",
    "团": "tuan",
    "园": "yuan",
    "固": "gu",
    "国": "guo",
    "土": "tu",
    "场": "chang",
    "坊": "fang",
    "城": "cheng",
    "堡": "bao",
    "堰": "yan",
    "塘": "tang",
    "境": "jing",
    "墩": "dun",
    "夏": "xia",
    "外": "wai",
    "大": "da",
    "天": "tian",
    "头": "tou",
    "奉": "feng",
    "如": "ru",
    "委": "wei",
    "宁": "ning",
    "安": "an",
    "定": "ding",
    "宜": "yi",
    "宝": "bao",
    "实": "shi",
    "宣": "xuan",
    "家": "jia",
    "富": "fu",
    "寺": "si",
    "寿": "shou",
    "小": "xiao",
    "山": "shan",
    "岳": "yue",
    "川": "chuan",
    "工": "gong",
    "巷": "xiang",
    "市": "shi",
    "平": "ping",
    "广": "guang",
    "庄": "zhuang",
    "庆": "qing",
    "店": "dian",
    "庙": "miao",
    "康": "kang",
    "廊": "lang",
    "延": "yan",
    "建": "jian",
    "开": "kai",
    "张": "zhang",
    "彭": "peng",
    "征": "zheng",
    "徐": "xu",
    "惠": "hui",
    "成": "cheng",
    "打": "da",
    "技": "ji",
    "控": "kong",
    "斜": "xie",
    "新": "xin",
    "方": "fang",
    "旅": "lv",
    "昆": "kun",
    "明": "ming",
    "易": "yi",
    "星": "xing",
    "曲": "qu",
    "曹": "cao",
    "月": "yue",
    "木": "mu",
    "术": "shu",
    "朱": "zhu",
    "村": "cun",
    "杨": "yang",
    "松": "song",
    "林": "lin",
    "枫": "feng",
    "柘": "zhe",
    "桃": "tao",
    "桥": "qiao",
    "梅": "mei",
    "榭": "xie",
    "横": "heng",
    "欧": "ou",
    "殷": "yin",
    "永": "yong",
    "汇": "hui",
    "江": "jiang",
    "汾": "fen",
    "沙": "sha",
    "沪": "hu",
    "河": "he",
    "沿": "yan",
    "泉": "quan",
    "泖": "mao",
    "泗": "si",
    "泥": "ni",
    "泽": "ze",
    "泾": "jing",
    "洋": "yang",
    "洞": "dong",
    "济": "ji",
    "浜": "bang",
    "浦": "pu",
    "海": "hai",
    "淞": "song",
    "淮": "huai",
    "渡": "du",
    "港": "gang",
    "游": "you",
    "湖": "hu",
    "湾": "wan",
    "滩": "tan",
    "漕": "cao",
    "潍": "wei",
    "片": "pian",
    "现": "xian",
    "瑞": "rui",
    "甘": "gan",
    "田": "tian",
    "由": "you",
    "白": "bai",
    "盈": "ying",
    "目": "mu",
    "真": "zhen",
    "石": "shi",
    "码": "ma",
    "社": "she",
    "祝": "zhu",
    "祥": "xiang",
    "科": "ke",
    "程": "cheng",
    "税": "shui",
    "竖": "shu",
    "站": "zhan",
    "管": "guan",
    "练": "lian",
    "经": "jing",
    "绿": "lv",
    "罗": "luo",
    "美": "mei",
    "翔": "xiang",
    "老": "lao",
    "自": "zi",
    "航": "hang",
    "花": "hua",
    "芷": "zhi",
    "苏": "su",
    "荡": "dang",
    "莘": "xin",
    "菊": "ju",
    "蔡": "cai",
    "虹": "hong",
    "行": "hang",
    "街": "jie",
    "西": "xi",
    "角": "jiao",
    "设": "she",
    "试": "shi",
    "谊": "yi",
    "豫": "yu",
    "贤": "xian",
    "贸": "mao",
    "赵": "zhao",
    "路": "lu",
    "车": "che",
    "道": "dao",
    "里": "li",
    "重": "chong",
    "金": "jin",
    "钢": "gang",
    "锦": "jin",
    "镇": "zhen",
    "长": "chang",
    "门": "men",
    "阳": "yang",
    "陆": "lu",
    "陇": "long",
    "陈": "chen",
    "院": "yuan",
    "霞": "xia",
    "青": "qing",
    "静": "jing",
    "顾": "gu",
    "颛": "zhuan",
    "风": "feng",
    "香": "xiang",
    "马": "ma",
    "验": "yan",
    "高": "gao",
    "鹤": "he",
    "龙": "long",
}


def slug(value: str) -> str:
    return "".join(ch if ch.isalnum() else "_" for ch in str(value).lower()).strip("_")


def title_pinyin(value: str) -> str:
    raw = "".join(PINYIN.get(ch, "") for ch in value)
    return raw[:1].upper() + raw[1:] if raw else "Local Area"


def local_name_en(name: str) -> str:
    if name in LOCAL_EXACT_EN:
        return LOCAL_EXACT_EN[name]
    for suffix, suffix_en in SUFFIX_EN:
        if name.endswith(suffix):
            base = name[: -len(suffix)]
            return f"{title_pinyin(base)} {suffix_en}"
    return title_pinyin(name)


def clean_geometry(geometry, tolerance: float):
    if geometry is None or geometry.is_empty:
        return geometry
    if not geometry.is_valid:
        geometry = geometry.buffer(0)
    return geometry.simplify(tolerance, preserve_topology=True)


def bounds_list(geometry) -> list[float]:
    minx, miny, maxx, maxy = geometry.bounds
    return [round(minx, 7), round(miny, 7), round(maxx, 7), round(maxy, 7)]


def find_parent_district(local_geom, districts: gpd.GeoDataFrame):
    point = local_geom.representative_point()
    for _, row in districts.iterrows():
        if row.geometry.contains(point) or row.geometry.intersects(point):
            return row
    best_row = None
    best_area = 0.0
    for _, row in districts.iterrows():
        area = local_geom.intersection(row.geometry).area
        if area > best_area:
            best_area = area
            best_row = row
    return best_row


def load_admin(source: Path):
    districts = gpd.read_file(source / "上海市_县界.shp").to_crs("EPSG:4326")
    locals_gdf = gpd.read_file(source / "上海市_乡镇边界.shp").to_crs("EPSG:4326")
    districts = districts.copy()
    locals_gdf = locals_gdf.copy()
    districts["geometry"] = districts.geometry.map(lambda geom: clean_geometry(geom, 0.00008))
    locals_gdf["geometry"] = locals_gdf.geometry.map(lambda geom: clean_geometry(geom, 0.00006))
    return districts, locals_gdf


def admin_feature(geometry, properties: dict) -> dict:
    return {
        "type": "Feature",
        "properties": properties,
        "geometry": mapping(geometry),
    }


def build_region_features(districts: gpd.GeoDataFrame, locals_gdf: gpd.GeoDataFrame):
    district_name_col = districts.columns[0]
    district_code_col = districts.columns[1]

    major_features = []
    major_by_id = {}
    for _, row in districts.sort_values(district_name_col).iterrows():
        source_name = str(row[district_name_col])
        region_id = str(row[district_code_col])
        name_en = DISTRICT_EN.get(source_name, local_name_en(source_name))
        props = {
            "region_id": region_id,
            "region_name": name_en,
            "region_group": region_id,
            "region_group_name": name_en,
            "source_name": source_name,
            "level": "district",
            "area_km2": round(float(row.get("面积", 0) or 0), 3),
            "bounds": bounds_list(row.geometry),
        }
        feature = admin_feature(row.geometry, props)
        major_features.append(feature)
        major_by_id[region_id] = feature

    local_features = []
    for _, row in locals_gdf.sort_values("OBJECTID").iterrows():
        source_name = str(row["name"])
        parent = find_parent_district(row.geometry, districts)
        if parent is None:
            continue
        parent_name = str(parent[district_name_col])
        parent_id = str(parent[district_code_col])
        raw_code = row.get("area_code")
        region_id = str(raw_code) if raw_code and str(raw_code) != "None" else f"{parent_id}-{int(row['OBJECTID']):03d}"
        props = {
            "region_id": region_id,
            "region_name": local_name_en(source_name),
            "region_group": parent_id,
            "region_group_name": DISTRICT_EN.get(parent_name, local_name_en(parent_name)),
            "source_name": source_name,
            "level": "local",
            "area_code": None if raw_code is None or str(raw_code) == "None" else str(raw_code),
            "objectid": int(row["OBJECTID"]),
            "bounds": bounds_list(row.geometry),
        }
        local_features.append(admin_feature(row.geometry, props))

    return major_features, local_features, major_by_id


def feature_rows_from_collection(path: Path, collection_key: str):
    data = json.loads(path.read_text(encoding="utf-8"))
    collection = data[collection_key]
    rows = []
    for feature in collection.get("features", []):
        grid_id = feature.get("properties", {}).get("grid_id")
        if grid_id is None:
            continue
        try:
            grid_id = int(float(grid_id))
        except (TypeError, ValueError):
            continue
        rows.append({"grid_id": grid_id, "geometry": shape(feature["geometry"])})
    return rows


def assign_grid_regions(rows: list[dict], local_features: list[dict]):
    if not rows:
        return {}, {}
    grid_gdf = gpd.GeoDataFrame(rows, geometry="geometry", crs="EPSG:4326")
    point_gdf = grid_gdf.copy()
    point_gdf["geometry"] = point_gdf.geometry.map(lambda geom: geom.representative_point())
    local_gdf = gpd.GeoDataFrame(
        [
            {
                "region_id": feature["properties"]["region_id"],
                "region_group": feature["properties"]["region_group"],
                "geometry": shape(feature["geometry"]),
            }
            for feature in local_features
        ],
        geometry="geometry",
        crs="EPSG:4326",
    )
    joined = gpd.sjoin(point_gdf, local_gdf, how="left", predicate="within")
    local_to_ids: dict[str, list[int]] = defaultdict(list)
    major_to_ids: dict[str, list[int]] = defaultdict(list)
    for _, row in joined.iterrows():
        local_id = row.get("region_id")
        major_id = row.get("region_group")
        grid_id = int(row["grid_id"])
        if isinstance(local_id, str) and local_id:
            local_to_ids[local_id].append(grid_id)
        if isinstance(major_id, str) and major_id:
            major_to_ids[major_id].append(grid_id)
    return {key: sorted(set(ids)) for key, ids in local_to_ids.items()}, {
        key: sorted(set(ids)) for key, ids in major_to_ids.items()
    }


def build_grid_index(data_dir: Path, local_features: list[dict]):
    sources = {
        "opportunity": (data_dir / "shanghai-platform-data.json", "opportunityGeojson"),
        "microclimate": (data_dir / "microclimate-platform-data.json", "microclimateGeojson"),
        "energy": (data_dir / "energy-platform-data.json", "energyGridGeojson"),
    }
    index = {}
    for key, (path, collection_key) in sources.items():
        if not path.exists():
            index[key] = {"local": {}, "major": {}}
            continue
        local_ids, major_ids = assign_grid_regions(feature_rows_from_collection(path, collection_key), local_features)
        index[key] = {"local": local_ids, "major": major_ids}
    return index


def attach_counts(major_features: list[dict], local_features: list[dict], grid_index: dict):
    for feature in local_features:
        rid = feature["properties"]["region_id"]
        for key in ("opportunity", "microclimate", "energy"):
            feature["properties"][f"{key}_grid_count"] = len(grid_index.get(key, {}).get("local", {}).get(rid, []))
    for feature in major_features:
        rid = feature["properties"]["region_id"]
        child_count = sum(1 for item in local_features if item["properties"]["region_group"] == rid)
        feature["properties"]["local_region_count"] = child_count
        for key in ("opportunity", "microclimate", "energy"):
            feature["properties"][f"{key}_grid_count"] = len(grid_index.get(key, {}).get("major", {}).get(rid, []))


def write_json(path: Path, payload: dict):
    path.write_text(json.dumps(payload, ensure_ascii=True, separators=(",", ":")), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA)
    args = parser.parse_args()

    districts, locals_gdf = load_admin(args.source)
    major_features, local_features, _ = build_region_features(districts, locals_gdf)
    grid_index = build_grid_index(args.data_dir, local_features)
    attach_counts(major_features, local_features, grid_index)

    local_index = [
        {
            "region_id": f["properties"]["region_id"],
            "region_name": f["properties"]["region_name"],
            "region_group": f["properties"]["region_group"],
            "region_group_name": f["properties"]["region_group_name"],
            "bounds": f["properties"]["bounds"],
            "opportunity_grid_count": f["properties"]["opportunity_grid_count"],
            "microclimate_grid_count": f["properties"]["microclimate_grid_count"],
            "energy_grid_count": f["properties"]["energy_grid_count"],
        }
        for f in local_features
    ]
    major_index = [
        {
            "region_id": f["properties"]["region_id"],
            "region_name": f["properties"]["region_name"],
            "bounds": f["properties"]["bounds"],
            "local_region_count": f["properties"]["local_region_count"],
            "opportunity_grid_count": f["properties"]["opportunity_grid_count"],
            "microclimate_grid_count": f["properties"]["microclimate_grid_count"],
            "energy_grid_count": f["properties"]["energy_grid_count"],
        }
        for f in major_features
    ]

    args.data_dir.mkdir(parents=True, exist_ok=True)
    write_json(args.data_dir / "shanghai-admin-major-regions.geojson", {"type": "FeatureCollection", "features": major_features})
    write_json(args.data_dir / "shanghai-admin-local-regions.geojson", {"type": "FeatureCollection", "features": local_features})
    write_json(
        args.data_dir / "shanghai-admin-region-index.json",
        {
            "metadata": {
                "major_region_count": len(major_features),
                "local_region_count": len(local_features),
                "source": str(args.source),
                "grid_index_kind": "500 m grid ids grouped by representative-point administrative region",
            },
            "majorRegions": major_index,
            "localRegions": local_index,
            "gridIndex": grid_index,
        },
    )

    print(f"Wrote {len(major_features)} major regions and {len(local_features)} local regions.")
    for key, payload in grid_index.items():
        total = sum(len(ids) for ids in payload.get("local", {}).values())
        print(f"{key}: {total} grid ids assigned")


if __name__ == "__main__":
    main()
