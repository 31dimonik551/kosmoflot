using UnityEngine;

namespace KosmoFlot.Meta
{
    /// <summary>Загрузка/сохранение PlayerData через PlayerPrefs (JSON-строка).</summary>
    public static class SaveSystem
    {
        private const string Key = "kf_meta_v1";

        public static PlayerData Load()
        {
            string json = PlayerPrefs.GetString(Key, string.Empty);
            if (string.IsNullOrEmpty(json)) return new PlayerData();
            try { return JsonUtility.FromJson<PlayerData>(json) ?? new PlayerData(); }
            catch { return new PlayerData(); }
        }

        public static void Save(PlayerData data)
        {
            PlayerPrefs.SetString(Key, JsonUtility.ToJson(data));
            PlayerPrefs.Save();
        }
    }
}
