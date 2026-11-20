import re
from datetime import datetime

# Station Name to ID Mapping (Shared configuration)
STATION_MAP2 = {
    "6000": "Taitung",
    "5240": "Kangle",
    "5230": "Zhiben",
    "5220": "Taimali",
    "5210": "Jinlun",
    "5200": "Longxi",
    "5190": "Dawu",
    "5170": "Fangye",
    "5160": "Fangshan",
    "5140": "Neishi",
    "5130": "Jialu",
    "5120": "Fangliao",
    "5100": "Jiadong",
    "5090": "Linbian",
    "5070": "Nanzhou",
    "5050": "Chaozhou",
    "5000": "Pingtung",
    "4460": "Jiuqutang",
    "4440": "Fengshan",
    "4400": "Kaohsiung",
    "4340": "Xinzuoying",
    "4310": "Gangshan",
    "4220": "Tainan",
    "6110": "Yuli",
    "6130": "Ruisui",
    "7000": "Hualien"
}

STATION_MAP = {
    "0900": "Keelung",
    "0910": "Sankeng",
    "0920": "Badu",
    "0930": "Qidu",
    "0940": "Baifu",
    "0950": "Wudu",
    "0960": "Xizhi",
    "0970": "Xike",
    "0980": "Nangang",
    "0990": "Songshan",
    "1000": "Taipei",
    "1010": "Wanhua",
    "1020": "Banqiao",
    "1030": "Fuzhou",
    "1040": "Shulin",
    "1050": "South Shulin",
    "1060": "Shanjia",
    "1070": "Yingge",
    "1080": "Taoyuan",
    "1090": "Neili",
    "1100": "Zhongli",
    "1110": "Puxin",
    "1120": "Yangmei",
    "1130": "Fugang",
    "1140": "Xinfu",
    "1150": "Beihu(China University of Technology)",
    "1160": "Hukou",
    "1170": "Xinfeng",
    "1180": "Zhubei",
    "1190": "North Hsinchu",
    "1210": "Hsinchu",
    "1220": "Sanxingqiao",
    "1230": "Xiangshan",
    "1240": "Qiding",
    "1250": "Zhunan",
    "3140": "Zaoqiao",
    "3150": "Fengfu",
    "3160": "Miaoli",
    "3170": "Nanshi",
    "3180": "Tongluo",
    "3190": "Sanyi",
    "3210": "Tai'an",
    "3220": "Houli",
    "3230": "Fengyuan",
    "3240": "Lilin",
    "3250": "Tanzi",
    "3260": "Toujiacuo",
    "3270": "Songzhu",
    "3280": "Taiyuan",
    "3290": "Jingwu",
    "3300": "Taichung",
    "3310": "Wuquan",
    "3320": "Daqing",
    "3330": "Wuri",
    "3340": "Xinwuri",
    "3350": "Chenggong",
    "3360": "Changhua",
    "3370": "Huatan",
    "3380": "Dacun",
    "3390": "Yuanlin",
    "3400": "Yongjing",
    "3410": "Shetou",
    "3420": "Tianzhong",
    "3430": "Ershui",
    "3450": "Linnei",
    "3460": "Shiliu",
    "3470": "Douliu",
    "3480": "Dounan",
    "3490": "Shigui",
    "4050": "Dalin",
    "4060": "Minxiong",
    "4070": "Jiabei",
    "4080": "Chiayi",
    "4090": "Shuishang",
    "4100": "Nanjing",
    "4110": "Houbi",
    "4120": "Xinying",
    "4130": "Liuying",
    "4140": "Linfengying",
    "4150": "Longtian",
    "4160": "Balin",
    "4170": "Shanhua",
    "4180": "Nanke",
    "4190": "Xinshi",
    "4200": "Yongkang",
    "4210": "Daqiao",
    "4220": "Tainan",
    "4230": "Linsen",
    "4240": "South Tainan",
    "4250": "Baoan",
    "4260": "Rende",
    "4270": "Zhongzhou",
    "4290": "Dahu",
    "4300": "Luzhu",
    "4310": "Gangshan",
    "4320": "Qiaotou",
    "4330": "Nanzi",
    "4340": "Xinzuoying",
    "4350": "Zuoying",
    "4360": "Neiwei",
    "4370": "Museum of Fine Arts",
    "4380": "Gushan",
    "4390": "Sankuaicuo",
    "4400": "Kaohsiung",
    "4410": "Minzu",
    "4420": "National Science and Technology Museum",
    "4430": "Zhengyi",
    "4440": "Fengshan",
    "4450": "Houzhuang",
    "4460": "Jiuqutang",
    "4470": "Liukuaicuo",
    "5000": "Pingtung",
    "2110": "Tanwen",
    "2120": "Dashan",
    "2130": "Houlong",
    "2140": "Longgang",
    "2150": "Baishatun",
    "2160": "Xinpu",
    "2170": "Tongxiao",
    "2180": "Yuanli",
    "2190": "Rinan",
    "2200": "Dajia",
    "2210": "Taichung Port",
    "2220": "Qingshui",
    "2230": "Shalu",
    "2240": "Longjing",
    "2250": "Dadu",
    "2260": "Zhuifen",
    "7390": "Nuannuan",
    "7380": "Sijiaoting",
    "7360": "Ruifang",
    "7350": "Houtong",
    "7330": "Sandiaoling",
    "7320": "Mudan",
    "7310": "Shuangxi",
    "7300": "Gongliao",
    "7290": "Fulong",
    "7280": "Shicheng",
    "7270": "Dali",
    "7260": "Daxi",
    "7250": "Guishan",
    "7240": "Waiao",
    "7230": "Toucheng",
    "7220": "Dingpu",
    "7210": "Jiaoxi",
    "7200": "Sicheng",
    "7190": "Yilan",
    "7180": "Erjie",
    "7170": "Zhongli",
    "7160": "Luodong",
    "7150": "Dongshan",
    "7140": "Xinma",
    "7130": "Su'aoxin",
    "7120": "Su'ao",
    "7110": "Yongle",
    "7100": "Dong'ao",
    "7090": "Nan'ao",
    "7080": "Wuta",
    "7070": "Hanben",
    "7060": "Heping",
    "7050": "Heren",
    "7040": "Chongde",
    "7030": "Xincheng",
    "7020": "Jingmei",
    "7010": "Beipu",
    "7000": "Hualien",
    "6250": "Ji'an",
    "6240": "Zhixue",
    "6230": "Pinghe",
    "6220": "Shoufeng",
    "6210": "Fengtian",
    "6200": "Linrong Xinquang",
    "6190": "Nanping",
    "6180": "Fenglin",
    "6170": "Wanrong",
    "6160": "Guangfu",
    "6150": "Dafu",
    "6140": "Fuyuan",
    "6130": "Ruisui",
    "6120": "Sanmin",
    "6110": "Yuli",
    "6100": "Dongli",
    "6090": "Dongzhu",
    "6080": "Fuli",
    "6070": "Chishang",
    "6060": "Haiduan",
    "6050": "Guanshan",
    "6040": "Ruihe",
    "6030": "Ruiyuan",
    "6020": "Luye",
    "6010": "Shanli",
    "6000": "Taitung",
    "5010": "Guilai",
    "5020": "Linluo",
    "5030": "Xishi",
    "5040": "Zhutian",
    "5050": "Chaozhou",
    "5060": "Kanding",
    "5070": "Nanzhou",
    "5080": "Zhen'an",
    "5090": "Linbian",
    "5100": "Jiadong",
    "5110": "Donghai",
    "5120": "Fangliao",
    "5130": "Jialu",
    "5140": "Neishi",
    "5160": "Fangshan",
    "5190": "Dawu",
    "5200": "Longxi",
    "5210": "Jinlun",
    "5220": "Taimali",
    "5230": "Zhiben",
    "5240": "Kangle",
    "7331": "Dahua",
    "7332": "Shifen",
    "7333": "Wanggu",
    "7334": "Lingjiao",
    "7335": "Pingxi",
    "7336": "Jingtong",
    "1191": "Qianjia",
    "1192": "Xinzhuang",
    "1193": "Zhuzhong",
    "1201": "Shangyuan",
    "1202": "Ronghua",
    "1203": "Zhudong",
    "1204": "Hengshan",
    "1205": "Jiuzantou",
    "1206": "Hexing",
    "1207": "Fugui",
    "1208": "Neiwan",
    "3431": "Yuanquan",
    "3432": "Zhuoshui",
    "3433": "Longquan",
    "3434": "Jiji",
    "3435": "Shuili",
    "3436": "Checheng",
    "4271": "Chang Jung Christian University",
    "4272": "Shalun",
    "1194": "Liujia",
    "7361": "NMMST",
    "7362": "Badouzi",
}

def get_station_name(station_id):
    return STATION_MAP.get(station_id, f"未知 ({station_id})")

def runs_today(note, ref_date=None):
    if ref_date is None:
        ref_date = datetime.now()
    weekday = ref_date.isoweekday() # 1=Mon, ..., 7=Sun
    weekdays_zh = ["週一", "週二", "週三", "週四", "週五", "週六", "週日"]
    
    if "停駛" in note:
        # Check ranges e.g. 週二~週四停駛
        match = re.search(r'(週[一二三四五六日])~(週[一二三四五六日])停駛', note)
        if match:
            start_idx = weekdays_zh.index(match.group(1))
            end_idx = weekdays_zh.index(match.group(2))
            current_idx = weekday - 1
            if start_idx <= current_idx <= end_idx:
                return False
        # Check single days
        for i, day in enumerate(weekdays_zh):
            if f"{day}停駛" in note and weekday == (i + 1):
                return False
                
    if "行駛" in note and "每日行駛" not in note:
        match = re.search(r'(週[一二三四五六日])~(週[一二三四五六日])行駛', note)
        if match:
            start_idx = weekdays_zh.index(match.group(1))
            end_idx = weekdays_zh.index(match.group(2))
            current_idx = weekday - 1
            if start_idx <= end_idx:
                if not (start_idx <= current_idx <= end_idx):
                    return False
            else:
                if not (current_idx >= start_idx or current_idx <= end_idx):
                    return False
        else:
            mentioned = [day for day in weekdays_zh if day in note]
            if mentioned:
                current_day_zh = weekdays_zh[weekday - 1]
                if current_day_zh not in mentioned:
                    return False
    return True

def calculate_duoliang_status(train_no, note, train_live_map, station_live_map):
    # Determine direction
    is_southbound = "南下" in note
    
    # Station configurations starting from closest to Duoliang outwards
    s2n_before = ["5200", "5190", "5160", "5140", "5130", "5120", "5100", "5090", "5070", "5050", "5000", "4460", "4440", "4400", "4340", "4310", "4220"]
    s2n_after = ["5210", "5220", "5230", "5240", "6000", "6110", "6130", "7000"]
    n2s_before = ["5210", "5220", "5230", "5240", "6000", "6110", "6130", "7000"]
    n2s_after = ["5200", "5190", "5160", "5140", "5130", "5120", "5100", "5090", "5070", "5050", "5000", "4460", "4440", "4400", "4340", "4310", "4220"]

    before_route = n2s_before if is_southbound else s2n_before
    current_delay = None

    for sid in before_route:
        key = f"{train_no}_{sid}"
        if key in train_live_map:
            current_delay = train_live_map[key]
            break
        elif key in station_live_map:
            current_delay = station_live_map[key]
            break

    # Fallback: check upcoming stations
    if current_delay is None:
        after_route = n2s_after if is_southbound else s2n_after
        for sid in after_route:
            key = f"{train_no}_{sid}"
            if key in train_live_map:
                current_delay = train_live_map[key]
                break
            elif key in station_live_map:
                current_delay = station_live_map[key]
                break

    best_delay = current_delay if current_delay is not None else 0

    # Pass/passing detection for Duoliang
    prev_id = "5210" if is_southbound else "5200" # Jinlun for southbound, Longxi for northbound
    next_id = "5200" if is_southbound else "5210" # Longxi for southbound, Jinlun for northbound
    
    next_station_key = f"{train_no}_{next_id}"
    prev_station_key = f"{train_no}_{prev_id}"
    is_passed = next_station_key in train_live_map
    is_passing = prev_station_key in train_live_map and next_station_key in station_live_map

    return best_delay, is_passed, is_passing

CHINESE_TO_ENGLISH_STATIONS = {
    "臺東": "Taitung", "康樂": "Kangle", "知本": "Zhiben", "太麻里": "Taimali", "金崙": "Jinlun", 
    "瀧溪": "Longxi", "大武": "Dawu", "枋山": "Fangshan", "內獅": "Neishi", "加祿": "Jialu", 
    "枋寮": "Fangliao", "佳冬": "Jiadong", "林邊": "Linbian", "南州": "Nanzhou", "潮州": "Chaozhou", 
    "屏東": "Pingtung", "九曲堂": "Jiuqutang", "鳳山": "Fengshan", "高雄": "Kaohsiung", 
    "新左營": "Xinzuoying", "岡山": "Gangshan", "臺南": "Tainan", "玉里": "Yuli", 
    "瑞穗": "Ruisui", "花蓮": "Hualien", "臺中": "Taichung"
}

TRAIN_TYPE_MAP = {
    "自強(3000)": "Tze-Chiang (3000)",
    "自強": "Tze-Chiang",
    "區間快": "Local Fast",
    "普悠瑪": "Puyuma",
    "莒光": "Chu-Kuang",
    "莒光號": "Chu-Kuang",
    "普快": "Ordinary",
    "區間": "Local"
}

def translate_station_name(zh_name):
    if not zh_name:
        return zh_name
    return CHINESE_TO_ENGLISH_STATIONS.get(zh_name, zh_name)

def translate_train_type(zh_type):
    if not zh_type:
        return zh_type
    return TRAIN_TYPE_MAP.get(zh_type, zh_type)
