#include <napi.h>
#include <gmp.h>
#include <assert.h>

using namespace Napi;

mpf_t phi;
mpf_t five_sqrt;

Napi::Value Fib(const Napi::CallbackInfo &info)
{
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsNumber())
  {
    Napi::TypeError::New(env, "fib requires an positive integer input")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  double arg0 = info[0].As<Napi::Number>().Int64Value();

  mpz_t f;

  mpz_init(f);
  mpz_fib_ui(f, arg0);

  // uint64_t

  char *data_f = mpz_get_str(NULL, 16, f);
  Napi::Buffer ret = Napi::Buffer<char>::New(env, data_f, strlen(data_f));

  mpz_clear(f);

  return ret;
}

Napi::Value FibPhi(const Napi::CallbackInfo &info)
{
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsNumber())
  {
    Napi::TypeError::New(env, "fib requires an positive integer input")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  u_int64_t arg0 = info[0].As<Napi::Number>().Int64Value();

  mpf_t f;
  mpf_t f_dec;

  mpf_init(f);
  mpf_set_prec(f, 1 << 16);

  mpf_pow_ui(f, phi, arg0);
  mpf_div(f, f, five_sqrt);

  mpf_init_set(f_dec, f);
  mpf_trunc(f, f);
  mpf_sub(f_dec, f_dec, f);
  if (mpf_cmp_d(f_dec, 0.5) >= 0)
  { // mpf_round doesn't exist
    mpf_add_ui(f, f, 1);
  }

  mp_exp_t *exp = new mp_exp_t(0);
  char *data_f = mpf_get_str(NULL, exp, 16, 0, f);
  size_t size_f = *exp;
  Napi::Buffer ret = Napi::Buffer<char>::New(env, size_f);
  size_t provided = strlen(data_f);
  memcpy(ret.Data(), data_f, provided);
  if (provided < size_f)
  {
    char *start = ret.Data() + provided;
    char *end = ret.Data() + ret.Length();
    for (char *c = start; c < end; ++c)
    {
      *c = '0';
    }
  }

  // mpf_clear(f);
  free(data_f);

  return ret;
}

mpf_t last;
mpf_t last_dec;
Napi::Value Step(const Napi::CallbackInfo &info)
{
  Napi::Env env = info.Env();

  mpf_mul(last, last, phi);

  mpf_set(last_dec, last);
  mpf_trunc(last, last);
  mpf_sub(last_dec, last_dec, last);
  if (mpf_cmp_d(last_dec, 0.5) >= 0)
  { // mpf_round doesn't exist
    mpf_add_ui(last, last, 1);
  }

  mp_exp_t *exp = new mp_exp_t(0);
  char *data_last = mpf_get_str(NULL, exp, 16, 0, last);
  size_t size_last = *exp;
  Napi::Buffer ret = Napi::Buffer<char>::New(env, size_last);
  size_t provided = strlen(data_last);
  memcpy(ret.Data(), data_last, provided);
  if (provided < size_last)
  {
    char *start = ret.Data() + provided;
    char *end = ret.Data() + ret.Length();
    for (char *c = start; c < end; ++c)
    {
      *c = '0';
    }
  }
  free(data_last);

  return ret;
}

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
  int prec = 1 << 16;

  // Compute phi

  mpf_init_set_ui(five_sqrt, 5);
  mpf_init(phi);

  mpf_set_prec(five_sqrt, prec);
  mpf_set_prec(phi, prec);

  mpf_sqrt(five_sqrt, five_sqrt);

  mpf_set(phi, five_sqrt);
  mpf_add_ui(phi, phi, 1);
  mpf_div_ui(phi, phi, 2);

  // Start last as 1 or fib(2)
  mpf_init_set_ui(last, 1);
  mpf_init_set_ui(last_dec, 0);
  mpf_set_prec(last, prec);
  mpf_set_prec(last_dec, prec);

  exports.Set(Napi::String::New(env, "fib"),
              Napi::Function::New(env, Fib));

  exports.Set(Napi::String::New(env, "fib_phi"),
              Napi::Function::New(env, FibPhi));

  exports.Set(Napi::String::New(env, "step"),
              Napi::Function::New(env, Step));
  return exports;
}

NODE_API_MODULE(addon, Init)
