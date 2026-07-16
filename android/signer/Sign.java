import com.android.apksig.ApkSigner;
import com.android.apksig.ApkVerifier;

import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.Certificate;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.List;

/**
 * Подпись APK через библиотеку apksig (v1 + v2 + v3), чтобы APK
 * устанавливался на современных Android без предупреждений о схеме подписи.
 * Аргументы: in.apk out.apk keystore.p12 storePass alias keyPass
 */
public class Sign {
    public static void main(String[] args) throws Exception {
        File in = new File(args[0]);
        File out = new File(args[1]);
        String ksPath = args[2], storePass = args[3], alias = args[4], keyPass = args[5];

        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (FileInputStream fis = new FileInputStream(ksPath)) {
            ks.load(fis, storePass.toCharArray());
        }
        PrivateKey key = (PrivateKey) ks.getKey(alias, keyPass.toCharArray());
        Certificate[] chain = ks.getCertificateChain(alias);
        List<X509Certificate> certs = new ArrayList<>();
        for (Certificate c : chain) certs.add((X509Certificate) c);

        ApkSigner.SignerConfig signer =
                new ApkSigner.SignerConfig.Builder("KOSMOFLOT", key, certs).build();

        List<ApkSigner.SignerConfig> signers = new ArrayList<>();
        signers.add(signer);

        // v2-схема (Android 7+/API 24). v1 отключён: старый apksig 2.3.0
        // использует внутренний API JDK, удалённый в Java 21.
        new ApkSigner.Builder(signers)
                .setInputApk(in)
                .setOutputApk(out)
                .setMinSdkVersion(24)
                .setV1SigningEnabled(false)
                .setV2SigningEnabled(true)
                .build()
                .sign();

        System.out.println("Signed -> " + out.getAbsolutePath());

        ApkVerifier.Result r = new ApkVerifier.Builder(out)
                .setMinCheckedPlatformVersion(24)
                .build()
                .verify();
        System.out.println("verified=" + r.isVerified()
                + " v1=" + r.isVerifiedUsingV1Scheme()
                + " v2=" + r.isVerifiedUsingV2Scheme());
        if (!r.isVerified()) {
            for (ApkVerifier.IssueWithParams e : r.getErrors()) System.out.println("ERR: " + e);
            System.exit(1);
        }
    }
}
