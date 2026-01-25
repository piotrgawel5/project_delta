package expo.modules.credentialauth

import android.app.Activity
import androidx.credentials.*
import androidx.credentials.exceptions.*
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.runBlocking

class CredentialAuthModule : Module() {

    override fun definition() = ModuleDefinition {
        Name("CredentialAuth")

        // ==========================================================
        // GOOGLE SIGN-IN
        // ==========================================================

        AsyncFunction("signInWithGoogleAutoSelect") { webClientId: String, autoSelect: Boolean ->
            val activity =
                appContext.activityProvider?.currentActivity
                    ?: throw Exception("NO_ACTIVITY")

            signInWithGoogle(activity, webClientId, autoSelect)
        }

        // ==========================================================
        // PASSKEYS
        // ==========================================================

        AsyncFunction("registerPasskey") { requestJson: String ->
            val activity =
                appContext.activityProvider?.currentActivity
                    ?: throw Exception("NO_ACTIVITY")

            createPasskey(activity, requestJson)
        }

        AsyncFunction("authenticateWithPasskey") { requestJson: String ->
            val activity =
                appContext.activityProvider?.currentActivity
                    ?: throw Exception("NO_ACTIVITY")

            getPasskey(activity, requestJson)
        }

        AsyncFunction("isPasskeyAvailable") {
            mapOf(
                "available" to (android.os.Build.VERSION.SDK_INT >= 28)
            )
        }
    }

    // ==========================================================
    // GOOGLE SIGN-IN
    // ==========================================================

    private fun signInWithGoogle(
        activity: Activity,
        webClientId: String,
        autoSelect: Boolean
    ): Map<String, Any?> = runBlocking {

        val credentialManager = CredentialManager.create(activity)

        val googleIdOption =
            GetGoogleIdOption.Builder()
                .setFilterByAuthorizedAccounts(false)
                .setServerClientId(webClientId)
                .setAutoSelectEnabled(autoSelect)
                .build()

        val request =
            GetCredentialRequest.Builder()
                .addCredentialOption(googleIdOption)
                .build()

        try {
            val result = credentialManager.getCredential(activity, request)
            val credential = result.credential

            if (
                credential is CustomCredential &&
                credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
            ) {
                val googleCred =
                    GoogleIdTokenCredential.createFrom(credential.data)

                return@runBlocking mapOf(
                    "idToken" to googleCred.idToken,
                    "subject" to googleCred.id,
                    "displayName" to googleCred.displayName,
                    "givenName" to googleCred.givenName,
                    "familyName" to googleCred.familyName,
                    "profilePictureUri" to googleCred.profilePictureUri?.toString()
                )
            }

            throw Exception("UNEXPECTED_CREDENTIAL")

        } catch (e: GetCredentialCancellationException) {
            throw Exception("USER_CANCELLED")
        } catch (e: NoCredentialException) {
            throw Exception("NO_CREDENTIAL")
        } catch (e: Exception) {
            throw Exception("GOOGLE_SIGN_IN_FAILED")
        }
    }

    // ==========================================================
    // PASSKEY REGISTRATION
    // ==========================================================

    private fun createPasskey(
        activity: Activity,
        requestJson: String
    ): Map<String, Any?> = runBlocking {

        val credentialManager = CredentialManager.create(activity)
        val request = CreatePublicKeyCredentialRequest(requestJson)

        try {
            val result =
                credentialManager.createCredential(activity, request)

            if (result is CreatePublicKeyCredentialResponse) {
                return@runBlocking mapOf(
                    "type" to "public-key",
                    "credential" to result.registrationResponseJson
                )
            }

            throw Exception("UNEXPECTED_RESPONSE")

        } catch (e: CreateCredentialCancellationException) {
            throw Exception("USER_CANCELLED")
        } catch (e: Exception) {
            throw Exception("PASSKEY_REGISTRATION_FAILED")
        }
    }

    // ==========================================================
    // PASSKEY AUTHENTICATION
    // ==========================================================

    private fun getPasskey(
        activity: Activity,
        requestJson: String
    ): Map<String, Any?> = runBlocking {

        val credentialManager = CredentialManager.create(activity)
        val option = GetPublicKeyCredentialOption(requestJson)

        val request =
            GetCredentialRequest.Builder()
                .addCredentialOption(option)
                .build()

        try {
            val result = credentialManager.getCredential(activity, request)
            val credential = result.credential

            if (credential is PublicKeyCredential) {
                return@runBlocking mapOf(
                    "type" to "public-key",
                    "credential" to credential.authenticationResponseJson
                )
            }

            throw Exception("UNEXPECTED_CREDENTIAL")

        } catch (e: GetCredentialCancellationException) {
            throw Exception("USER_CANCELLED")
        } catch (e: NoCredentialException) {
            throw Exception("NO_CREDENTIAL")
        } catch (e: Exception) {
            throw Exception("PASSKEY_AUTH_FAILED")
        }
    }
}
