
(function () {
  const $ = (id) => document.getElementById(id);

  let supabaseClient = null;
  let verifiedMember = null;
  let memberCode = "";

  function getClient() {
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("Unable to load the connection library. Please try again.");
    }

    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      throw new Error("Website configuration is missing. Please contact the committee.");
    }

    if (!supabaseClient) {
      supabaseClient = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_ANON_KEY
      );
    }

    return supabaseClient;
  }

  function showMessage(id, text, success) {
    const el = $(id);
    el.textContent = text;
    el.className = "consent-message";

    if (success) {
      el.classList.add("success");
    } else if (text) {
      el.classList.add("error");
    }
  }

  function normalizeCode(value) {
    return String(value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  $("verifyForm").addEventListener("submit", async function (event) {
    event.preventDefault();

    const flat = $("flat").value.trim();
    memberCode = normalizeCode($("accessCode").value);

    const button = $("verifyButton");
    button.disabled = true;
    button.textContent = "Verifying...";

    showMessage("verifyMessage", "", false);
    $("termsCard").classList.add("hidden");
    verifiedMember = null;

    try {
      const client = getClient();

      const { data, error } = await client.rpc("member_login", {
        p_flat: flat,
        p_code: memberCode
      });

     if (error) throw error;

    if (!data || data.ok !== true) {
      throw new Error(
        (data && data.message) ||
        "Your details could not be verified. Please check your flat number and access code."
      );
    }

    if (!data.pre_allocated_slot) {
      throw new Error(
      "These details could not be verified as a pre-allocated member. Please contact the committee."
      );
    }

      verifiedMember = {
        flat: data.flat || flat,
        slot: data.pre_allocated_slot
      };

      $("verifiedFlat").textContent = verifiedMember.flat;
      $("verifiedSlot").textContent = verifiedMember.slot;
      $("agreeTerms").checked = false;
      $("submitButton").disabled = true;

      $("termsCard").classList.remove("hidden");

      showMessage(
        "verifyMessage",
        "Details verified. Please review the terms carefully.",
        true
      );

      $("termsCard").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    } catch (error) {
      showMessage(
        "verifyMessage",
        error.message || "Verification failed. Please try again.",
        false
      );
    } finally {
      button.disabled = false;
      button.textContent = "Verify my details";
    }
  });

  $("agreeTerms").addEventListener("change", function () {
    $("submitButton").disabled =
      !this.checked || !verifiedMember;
  });

  $("consentForm").addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!verifiedMember || !$("agreeTerms").checked) return;

    const button = $("submitButton");
    button.disabled = true;
    button.textContent = "Submitting...";

    showMessage("submitMessage", "", false);

    try {
      const client = getClient();

      const { data, error } = await client.rpc(
        "submit_preallocated_consent",
        {
          p_flat: verifiedMember.flat,
          p_code: memberCode,
          p_agree: true
        }
      );

      if (error) throw error;

      if (!data || data.ok !== true) {
        throw new Error(
          (data && data.message) ||
          "The agreement could not be recorded."
        );
      }

      let confirmation =
        data.message || "Your acceptance has been recorded.";

      if (data.agreed_at) {
        confirmation +=
          " Recorded at: " +
          new Date(data.agreed_at).toLocaleString();
      }

      showMessage("submitMessage", confirmation, true);

      $("consentStatus") &&
        ($("consentStatus").textContent =
          "Your acceptance has been recorded.");

      $("consentForm").classList.add("hidden");
    } catch (error) {
      showMessage(
        "submitMessage",
        error.message || "Submission failed. Please try again.",
        false
      );

      button.disabled = !$("agreeTerms").checked;
    } finally {
      button.textContent = "I Agree & Submit";
    }
  });
})();
