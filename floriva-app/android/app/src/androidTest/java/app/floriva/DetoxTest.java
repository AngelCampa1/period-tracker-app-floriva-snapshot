package app.floriva;

import android.content.Context;
import android.content.ContextWrapper;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.filters.LargeTest;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.rule.ActivityTestRule;

import com.facebook.react.ReactHost;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactNativeHost;
import com.wix.detox.Detox;
import com.wix.detox.config.DetoxConfig;

import org.json.JSONException;
import org.json.JSONObject;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

class ReactNativeHolder extends ContextWrapper implements ReactApplication {
  ReactNativeHolder(Context base) {
    super(base);
  }

  @Override
  public ReactNativeHost getReactNativeHost() {
    return ((ReactApplication) getApplicationContext()).getReactNativeHost();
  }

  @Override
  public ReactHost getReactHost() {
    return ((ReactApplication) getApplicationContext()).getReactHost();
  }
}

@RunWith(AndroidJUnit4.class)
@LargeTest
public class DetoxTest {
  private static final String DEV_LAUNCHER_RECENT_APPS_PREFS =
      "expo.modules.devlauncher.recentyopenedapps";
  private static final String DEV_SERVER_URL_ARG = "detoxFlorivaDevServerUrl";
  private static final String DEFAULT_ANDROID_DEV_SERVER_URL = "http://10.0.2.2:8081";

  @Rule
  public ActivityTestRule<MainActivity> activityRule =
      new ActivityTestRule<>(MainActivity.class, false, false);

  @Test
  public void runDetoxTests() {
    Context appContext =
        InstrumentationRegistry.getInstrumentation().getTargetContext().getApplicationContext();
    seedDevLauncherRecentApp(appContext);

    DetoxConfig detoxConfig = new DetoxConfig();
    detoxConfig.idlePolicyConfig.masterTimeoutSec = 90;
    detoxConfig.rnContextLoadTimeoutSec = 180;

    Detox.runTests(activityRule, new ReactNativeHolder(appContext), detoxConfig);
  }

  private void seedDevLauncherRecentApp(Context context) {
    String devServerUrl =
        InstrumentationRegistry.getArguments()
            .getString(DEV_SERVER_URL_ARG, DEFAULT_ANDROID_DEV_SERVER_URL);

    try {
      JSONObject recentApp = new JSONObject();
      recentApp.put("timestamp", System.currentTimeMillis());
      recentApp.put("url", devServerUrl);
      recentApp.put("isEASUpdate", false);

      context
          .getSharedPreferences(DEV_LAUNCHER_RECENT_APPS_PREFS, Context.MODE_PRIVATE)
          .edit()
          .putString(devServerUrl, recentApp.toString())
          .commit();
    } catch (JSONException error) {
      throw new IllegalStateException("Unable to seed Expo dev launcher for Detox.", error);
    }
  }
}
