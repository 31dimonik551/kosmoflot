using System;
using System.Collections;
using UnityEngine;

namespace KosmoFlot.Meta
{
    /// <summary>
    /// Награда за просмотр рекламы. Сейчас — заглушка (симуляция показа).
    ///
    /// ИНТЕГРАЦИЯ РЕАЛЬНОГО SDK (Unity Ads / LevelPlay):
    ///   1) Package Manager → Advertisement (com.unity.ads).
    ///   2) Project Settings → Services → включить Ads, вставить Game ID.
    ///   3) Реализовать IUnityAdsLoadListener / IUnityAdsShowListener и
    ///      вызывать _onReward() в OnUnityAdsShowComplete при
    ///      UnityAdsShowCompletionState.COMPLETED.
    ///   4) Заменить тело ShowRewarded() на Advertisement.Show(adUnitId, this).
    /// Внешний код не меняется — контракт остаётся ShowRewarded(onReward).
    /// </summary>
    public class RewardedAdManager : MonoBehaviour
    {
        [Tooltip("Длительность симуляции показа рекламы, сек.")]
        public float simulatedDuration = 3f;

        public bool IsShowing { get; private set; }

        /// <summary>Показать rewarded-рекламу. onReward вызывается при полном просмотре.</summary>
        public void ShowRewarded(Action onReward, Action onProgress = null)
        {
            if (IsShowing) return;
            StartCoroutine(SimulateAd(onReward, onProgress));
        }

        private IEnumerator SimulateAd(Action onReward, Action onProgress)
        {
            IsShowing = true;
            float t = simulatedDuration;
            while (t > 0f)
            {
                onProgress?.Invoke();
                yield return new WaitForSecondsRealtime(1f);
                t -= 1f;
            }
            IsShowing = false;
            onReward?.Invoke();
        }
    }
}
